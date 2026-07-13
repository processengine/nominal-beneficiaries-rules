import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { customOperatorMeta } from "./operators.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const processorDir = process.env.PROCESSOR_REPO || path.resolve(rootDir, "../processor-preprod");

const contours = [
  {
    key: "fl_resident",
    type: "FL_RESIDENT",
    label: "ФЛ-резидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    fixturePath: path.join(processorDir, "fixtures/TC-009-valid-fl-resident-fias-no-addressline.json"),
    entrypointId: "entrypoints.fl_resident.full_validation",
    currentDate: "2026-04-12",
  },
  {
    key: "fl_nonresident",
    type: "FL_NONRESIDENT",
    label: "ФЛ-нерезидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/fl-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    fixturePath: path.join(processorDir, "fixtures/BEN-FL-NONRES-FOREIGN-PASSPORT-VALID.json"),
    belarusFixturePath: path.join(processorDir, "fixtures/BEN-FL-NONRES-BELARUS-NO-ADDDOC-VALID.json"),
    entrypointId: "entrypoints.fl_nonresident.full_validation",
    currentDate: "2026-05-18",
  },
];

const residentTaxFlagConfigs = [
  {
    key: "foreign_tax_resident",
    field: "beneficiary.tax.foreignTaxResident",
    name: "иностранного налогового резидентства",
    requiredId: "library.tax.foreign_tax_resident_required",
    typeRuleId: "library.tax.foreign_tax_resident_bool",
    notTrueRuleId: "internal.fl_resident.blocks.tax_flags.foreign_tax_resident_not_true",
  },
  {
    key: "us_tax_resident",
    field: "beneficiary.tax.usTaxResident",
    name: "налогового резидентства США",
    requiredId: "library.tax.us_tax_resident_required",
    typeRuleId: "library.tax.us_tax_resident_bool",
    notTrueRuleId: "internal.fl_resident.blocks.tax_flags.us_tax_resident_not_true",
  },
  {
    key: "us_resident",
    field: "beneficiary.tax.usResident",
    name: "резидентства США",
    requiredId: "library.tax.us_resident_required",
    typeRuleId: "library.tax.us_resident_bool",
    notTrueRuleId: "internal.fl_resident.blocks.tax_flags.us_resident_not_true",
  },
];

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function repoRelative(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function normalizeKnownLegacyDuplicates(artifacts) {
  const issueDateCondition = artifacts.find(
    (artifact) => artifact.id === "library.documents.cond_issue_date_gt_birth_if_format_ok",
  );
  if (!issueDateCondition || !Array.isArray(issueDateCondition.steps)) return;

  issueDateCondition.steps = issueDateCondition.steps.filter(
    (step) => step.rule !== "library.documents.issue_date_not_future",
  );
  issueDateCondition.description = "Если дата выдачи документа корректна, проверяем, что она позже даты рождения";
}

function replaceBooleanDictionaryWithOperator(artifacts) {
  for (const artifact of artifacts) {
    if (artifact.type !== "rule" || artifact.dictionary?.id !== "true_false") continue;
    artifact.operator = "is_boolean";
    delete artifact.dictionary;
  }

  return artifacts.filter((artifact) => artifact.id !== "true_false");
}

function upsertArtifact(artifacts, artifact) {
  const index = artifacts.findIndex((item) => item.id === artifact.id);
  if (index >= 0) {
    artifacts[index] = artifact;
    return;
  }
  artifacts.push(artifact);
}

function refactorResidentTaxFlagPipeline(artifacts) {
  const pipeline = artifacts.find((artifact) => artifact.id === "internal.fl_resident.blocks.tax_flags");
  if (!pipeline || !Array.isArray(pipeline.flow)) return;

  for (const config of residentTaxFlagConfigs) {
    const presentPredicateId = `library.tax.pred_${config.key}_present`;
    const booleanPredicateId = `library.tax.pred_${config.key}_boolean`;
    const typeConditionId = `library.tax.cond_${config.key}_type_if_present`;
    const valueConditionId = `internal.fl_resident.blocks.tax_flags.cond_${config.key}_not_true_if_boolean`;

    upsertArtifact(artifacts, {
      id: config.requiredId,
      type: "rule",
      description: `Признак ${config.name} должен быть указан`,
      role: "check",
      operator: "not_empty",
      level: "EXCEPTION",
      code: `BEN.TAX.${config.key.toUpperCase()}.REQUIRED`,
      message: `Не указан признак ${config.name}`,
      field: config.field,
    });

    upsertArtifact(artifacts, {
      id: presentPredicateId,
      type: "rule",
      description: `Проверяет, что признак ${config.name} указан`,
      role: "predicate",
      operator: "not_empty",
      field: config.field,
    });

    upsertArtifact(artifacts, {
      id: booleanPredicateId,
      type: "rule",
      description: `Проверяет, что признак ${config.name} передан как true или false`,
      role: "predicate",
      operator: "is_boolean",
      field: config.field,
    });

    upsertArtifact(artifacts, {
      id: typeConditionId,
      type: "condition",
      description: `Если признак ${config.name} указан, проверяем, что он передан как true или false`,
      when: { all: [presentPredicateId] },
      steps: [{ rule: config.typeRuleId }],
    });

    upsertArtifact(artifacts, {
      id: valueConditionId,
      type: "condition",
      description: `Если признак ${config.name} передан как true или false, проверяем допустимое значение`,
      when: { all: [booleanPredicateId] },
      steps: [{ rule: config.notTrueRuleId }],
    });
  }

  pipeline.description = "Регуляторные флаги: обязательность, тип и допустимое значение";
  pipeline.flow = residentTaxFlagConfigs.flatMap((config) => [
    { rule: config.requiredId },
    { condition: `library.tax.cond_${config.key}_type_if_present` },
    { condition: `internal.fl_resident.blocks.tax_flags.cond_${config.key}_not_true_if_boolean` },
  ]);
}

function addResidentTaxFlagCatalog(manifest) {
  for (const config of residentTaxFlagConfigs) {
    const presentPredicateId = `library.tax.pred_${config.key}_present`;
    const booleanPredicateId = `library.tax.pred_${config.key}_boolean`;
    const typeConditionId = `library.tax.cond_${config.key}_type_if_present`;
    const valueConditionId = `internal.fl_resident.blocks.tax_flags.cond_${config.key}_not_true_if_boolean`;

    manifest.catalog.artifacts[config.requiredId] = {
      title: `Признак ${config.name} указан`,
      description: `Проверяет, что признак ${config.name} передан в заявке`,
    };
    manifest.catalog.artifacts[presentPredicateId] = {
      title: `Признак ${config.name} заполнен`,
      description: `Условие для проверок, которые выполняются только после передачи признака ${config.name}`,
    };
    manifest.catalog.artifacts[booleanPredicateId] = {
      title: `Признак ${config.name} является true или false`,
      description: `Условие для бизнес-проверки признака ${config.name} после контроля типа`,
    };
    manifest.catalog.artifacts[typeConditionId] = {
      title: `Если признак ${config.name} указан, проверяем тип`,
      description: `Контроль формата признака ${config.name} выполняется только после проверки наличия поля`,
    };
    manifest.catalog.artifacts[valueConditionId] = {
      title: `Если признак ${config.name} корректного типа, проверяем значение`,
      description: `Бизнес-запрет значения true выполняется только после проверки, что поле является true или false`,
    };
  }
}

function addStudioPolishCatalog(manifest) {
  const artifacts = {
    "library.address.cond_registration_fias_structure_for_ru": [
      "Если адрес регистрации в РФ, проверяем структуру ФИАС",
      "Для российского адреса регистрации проверяет обязательные структурные поля адреса",
    ],
    "library.fl_nonresident.address.cond_registration_fias_structure_for_ru": [
      "Если адрес нерезидента в РФ, проверяем структуру ФИАС",
      "Для российского адреса места жительства, регистрации или пребывания ФЛ-нерезидента проверяет обязательные структурные поля адреса",
    ],
    "library.address.cond_street_type_if_present": [
      "Если указан тип улицы, проверяем справочник",
      "Проверяет тип улицы адреса регистрации только когда поле заполнено",
    ],
    "library.address.pred_registration_country_ru": [
      "Страна адреса регистрации — Россия",
      "Условие для проверок российской структуры адреса регистрации",
    ],
    "library.address.pred_street_type_present": [
      "Тип улицы адреса регистрации заполнен",
      "Условие для проверки типа улицы по справочнику",
    ],
    "library.address.registration_city_or_locality_required_for_ru": [
      "Город или населённый пункт обязателен для адреса РФ",
      "Для российского адреса регистрации должен быть указан город или населённый пункт",
    ],
    "library.address.registration_house_required_for_ru": [
      "Дом обязателен для адреса РФ",
      "Для российского адреса регистрации должен быть указан дом",
    ],
    "library.address.registration_postal_required_for_ru": [
      "Индекс обязателен для адреса РФ",
      "Для российского адреса регистрации должен быть указан почтовый индекс",
    ],
    "library.address.registration_region_code_required_for_ru": [
      "Код региона обязателен для адреса РФ",
      "Для российского адреса регистрации должен быть указан код региона",
    ],
    "library.address.registration_street_required_for_ru": [
      "Улица обязательна для адреса РФ",
      "Для российского адреса регистрации должна быть указана улица",
    ],
    "library.address.registration_street_type_required_for_ru": [
      "Тип улицы обязателен для адреса РФ",
      "Для российского адреса регистрации должен быть указан тип улицы",
    ],
    "library.address.street_type_in_dictionary": [
      "Тип улицы есть в справочнике",
      "Проверяет, что тип улицы адреса регистрации поддерживается справочником",
    ],
    "library.common.account_number_format": [
      "Номер номинального счёта корректного формата",
      "Проверяет формат номера номинального счёта для привязки бенефициара",
    ],
    "library.common.account_number_required": [
      "Номер номинального счёта указан",
      "Проверяет, что номер номинального счёта передан в заявке",
    ],
    "library.common.cond_account_number_if_present": [
      "Если номер счёта указан, проверяем формат",
      "Формат номера номинального счёта проверяется только после передачи поля",
    ],
    "library.common.pred_account_number_present": [
      "Номер номинального счёта заполнен",
      "Условие для проверки формата номера номинального счёта",
    ],
    "library.nonresident.add_doc_issuer_required": [
      "Кем выдан документ на пребывание указано",
      "Проверяет, что заполнен орган, выдавший документ на право пребывания",
    ],
    "library.nonresident.cond_add_doc_right_to_stay_doc": [
      "Если выбран документ на право пребывания, проверяем его поля",
      "Выполняет проверки серии и органа выдачи для документа на право пребывания",
    ],
    "library.nonresident.pred_add_doc_typeCode_migr": [
      "Документ на пребывание — миграционная карта",
      "Условие для проверок, которые применяются к миграционной карте",
    ],
    "library.nonresident.pred_add_doc_typeCode_not_migr": [
      "Документ на пребывание не является миграционной картой",
      "Условие для проверок, которые применяются к документу на право пребывания кроме миграционной карты",
    ],
  };

  for (const [id, [title, description]] of Object.entries(artifacts)) {
    manifest.catalog.artifacts[id] = { title, description };
  }
}

function addScopedConflictCatalog(manifest, conflictMap) {
  for (const [sourceId, scopedId] of Object.entries(conflictMap)) {
    const sourceMeta = manifest.catalog.artifacts[sourceId];
    if (sourceMeta && !manifest.catalog.artifacts[scopedId]) {
      manifest.catalog.artifacts[scopedId] = {
        ...sourceMeta,
        description: `${sourceMeta.description || sourceMeta.title}. Версия правила для ФЛ-нерезидента.`,
      };
    }
  }
}

function readSource(contour) {
  return JSON.parse(readFileSync(contour.sourcePath, "utf8"));
}

function prepareArtifacts(source, contour) {
  let artifacts = cloneJson(source.artifacts);
  normalizeKnownLegacyDuplicates(artifacts);
  artifacts = replaceBooleanDictionaryWithOperator(artifacts);
  if (contour.key === "fl_resident") {
    refactorResidentTaxFlagPipeline(artifacts);
  }
  return artifacts;
}

function buildConflictMap(baseArtifacts, nextArtifacts, contour) {
  const result = {};
  const byId = new Map(baseArtifacts.map((artifact) => [artifact.id, artifact]));

  for (const artifact of nextArtifacts) {
    const existing = byId.get(artifact.id);
    if (!existing || stableJson(existing) === stableJson(artifact)) continue;

    result[artifact.id] = scopedArtifactId(artifact, contour);
  }

  return result;
}

function scopedArtifactId(artifact, contour) {
  if (artifact.type === "dictionary") {
    return `dictionaries.${contour.key}.${artifact.id.replace(/^dictionaries\./, "")}`;
  }
  if (artifact.id.startsWith("library.")) {
    return `library.${contour.key}.${artifact.id.replace(/^library\./, "")}`;
  }
  return `${contour.entrypointId}.scoped.${artifact.id.replaceAll(".", "_")}`;
}

function resolveConflictMap(baseArtifacts, nextArtifacts, contour) {
  const byId = new Map(baseArtifacts.map((artifact) => [artifact.id, artifact]));
  const conflictMap = buildConflictMap(baseArtifacts, nextArtifacts, contour);
  let changed = true;

  while (changed) {
    changed = false;
    for (const artifact of nextArtifacts) {
      const rewritten = rewriteIds(artifact, conflictMap);
      const existing = byId.get(rewritten.id);
      if (!existing || stableJson(existing) === stableJson(rewritten)) continue;

      if (!conflictMap[artifact.id]) {
        conflictMap[artifact.id] = scopedArtifactId(artifact, contour);
        changed = true;
        continue;
      }

      throw new Error(`Unresolved artifact conflict after transitive rewrite: ${rewritten.id}`);
    }
  }

  return conflictMap;
}

function rewriteIds(value, idMap) {
  if (typeof value === "string") return idMap[value] || value;
  if (Array.isArray(value)) return value.map((item) => rewriteIds(item, idMap));
  if (!value || typeof value !== "object") return value;

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = rewriteIds(item, idMap);
  }
  return result;
}

function mergeArtifacts(contourArtifacts) {
  const [resident, ...rest] = contourArtifacts;
  const merged = [...resident.artifacts];
  const reports = [];

  for (const contour of rest) {
    const conflictMap = resolveConflictMap(merged, contour.artifacts, contour);
    const rewrittenArtifacts = contour.artifacts.map((artifact) => rewriteIds(artifact, conflictMap));
    const byId = new Map(merged.map((artifact) => [artifact.id, artifact]));
    let shared = 0;
    let added = 0;

    for (const artifact of rewrittenArtifacts) {
      const existing = byId.get(artifact.id);
      if (existing && stableJson(existing) === stableJson(artifact)) {
        shared += 1;
        continue;
      }
      if (existing) {
        throw new Error(`Unresolved artifact conflict after rewrite: ${artifact.id}`);
      }
      merged.push(artifact);
      byId.set(artifact.id, artifact);
      added += 1;
    }

    reports.push({
      contour: contour.key,
      sourceArtifacts: contour.artifacts.length,
      shared,
      added,
      scopedConflicts: Object.keys(conflictMap).length,
      conflictMap,
    });
  }

  return { artifacts: merged, reports };
}

function namespaceDuplicateCheckCodes(artifacts) {
  const seen = new Map();
  const aliases = [];

  for (const artifact of artifacts) {
    if (artifact.type !== "rule" || artifact.role !== "check" || typeof artifact.code !== "string") continue;

    if (!seen.has(artifact.code)) {
      seen.set(artifact.code, artifact.id);
      continue;
    }

    const legacyCode = artifact.code;
    const prefix = artifact.id.includes("fl_nonresident") ? "FL_NONRESIDENT" : "RULESET";
    let candidate = `${prefix}.${legacyCode}`;
    let index = 2;
    while (seen.has(candidate)) {
      candidate = `${prefix}.${index}.${legacyCode}`;
      index += 1;
    }

    artifact.meta = {
      ...(artifact.meta || {}),
      legacyCode,
      codeNamespaceReason: "jsonspecs requires unique check codes inside one compiled ruleset",
    };
    artifact.code = candidate;
    seen.set(candidate, artifact.id);
    aliases.push({ artifactId: artifact.id, legacyCode, code: candidate, firstArtifactId: seen.get(legacyCode) });
  }

  return aliases;
}

function mergeCatalogs(sources, reports) {
  const manifest = {
    project: {
      id: "nominal-beneficiaries-rules",
      version: "0.2.0",
      title: "Бенефициары номинальных счетов",
      description: "Пакет правил проверок заявок бенефициаров номинальных счетов. Текущий slice содержит FL_RESIDENT и FL_NONRESIDENT validate-application в режиме parity с processor-preprod.",
      language: "ru",
    },
    paths: {
      rules: "./rules",
      samples: "./samples",
      docs: "./docs",
      dist: "./dist",
    },
    studio: {
      port: 3100,
      openBrowser: true,
    },
    build: {
      snapshotFile: "snapshot.json",
      buildInfoFile: "build-info.json",
    },
    operatorPacks: {
      node: ["./operators/node"],
    },
    catalog: {
      fields: {},
      entrypoints: {},
      artifacts: {},
      operators: customOperatorMeta(),
    },
  };

  for (const source of sources) {
    const catalog = source.manifest?.catalog || {};
    Object.assign(manifest.catalog.fields, catalog.fields || {});
    Object.assign(manifest.catalog.entrypoints, catalog.entrypoints || {});
    Object.assign(manifest.catalog.artifacts, catalog.artifacts || {});
    Object.assign(manifest.catalog.operators, catalog.operators || {});
  }

  for (const report of reports) {
    addScopedConflictCatalog(manifest, report.conflictMap);
  }

  manifest.catalog.operators = {
    ...manifest.catalog.operators,
    ...customOperatorMeta(),
  };
  delete manifest.catalog.artifacts.true_false;
  addResidentTaxFlagCatalog(manifest);
  addStudioPolishCatalog(manifest);

  return manifest;
}

function fileForArtifact(artifact) {
  const parts = artifact.id.split(".");

  if (artifact.type === "dictionary") {
    if (artifact.id.startsWith("dictionaries.")) {
      return path.join(rootDir, "rules/dictionaries", ...parts.slice(1, -1), `${parts.at(-1)}.json`);
    }
    return path.join(rootDir, "rules/dictionaries", `${artifact.id}.json`);
  }

  for (const contour of contours) {
    if (artifact.id === contour.entrypointId) {
      return path.join(rootDir, "rules/entrypoints", contour.key, "full_validation.json");
    }
    if (artifact.id.startsWith(`${contour.entrypointId}.library.`)) {
      const scopedParts = artifact.id.slice(`${contour.entrypointId}.library.`.length).split(".");
      return path.join(rootDir, "rules/entrypoints", contour.key, "library", ...scopedParts.slice(0, -1), `${scopedParts.at(-1)}.json`);
    }
    if (artifact.id.startsWith(`${contour.entrypointId}.`)) {
      return path.join(rootDir, "rules/entrypoints", contour.key, "checks", `${parts.at(-1)}.json`);
    }
    if (artifact.id.startsWith(`internal.${contour.key}.`)) {
      return path.join(rootDir, "rules/internal", contour.key, ...parts.slice(2, -1), `${parts.at(-1)}.json`);
    }
  }

  if (artifact.id.startsWith("library.")) {
    return path.join(rootDir, "rules/library", ...parts.slice(1, -1), `${parts.at(-1)}.json`);
  }

  return path.join(rootDir, "rules/other", ...parts.slice(0, -1), `${parts.at(-1)}.json`);
}

function readApplicationFixture(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8")).application;
}

function sample(contour, name, payload, expected, extra = {}) {
  return {
    name,
    context: {
      pipelineId: contour.entrypointId,
      currentDate: contour.currentDate,
    },
    payload,
    expect: expected,
    ...extra,
  };
}

function writeResidentSamples(contour) {
  const ok = readApplicationFixture(contour.fixturePath);
  const missingInn = cloneJson(ok);
  delete missingInn.beneficiary.inn;
  const usTaxResident = cloneJson(ok);
  usTaxResident.beneficiary.tax.usTaxResident = true;
  const futureIssueDate = cloneJson(ok);
  futureIssueDate.beneficiary.idDoc.issueDate = "2026-12-01";
  const invalidBoolean = cloneJson(ok);
  invalidBoolean.beneficiary.tax.foreignTaxResident = "false";
  const missingTaxFlag = cloneJson(ok);
  delete missingTaxFlag.beneficiary.tax.foreignTaxResident;

  writeJson(
    path.join(rootDir, "samples/fl-resident.ok.json"),
    sample(contour, "FL resident valid application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-resident.missing-inn.json"),
    sample(contour, "FL resident missing INN", missingInn, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "FL.INN.REQUIRED", field: "beneficiary.inn", level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-resident.us-tax-resident.json"),
    sample(contour, "FL resident US tax resident reject", usTaxResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.US_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.usTaxResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-resident.future-issue-date.json"),
    sample(contour, "FL resident future document issue date", futureIssueDate, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "BEN.IDDOC.ISSUE_DATE.NOT_FUTURE", field: "beneficiary.idDoc.issueDate", level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-resident.invalid-boolean.json"),
    sample(contour, "FL resident invalid boolean tax flag", invalidBoolean, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.FOREIGN_TAX_RESIDENT.BOOL", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-resident.missing-tax-flag.json"),
    sample(
      contour,
      "FL resident missing tax flag",
      missingTaxFlag,
      {
        status: "EXCEPTION",
        exact: true,
        issues: [{ code: "BEN.TAX.FOREIGN_TAX_RESIDENT.REQUIRED", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
      },
      { legacyParity: false },
    ),
  );
}

function writeNonresidentSamples(contour) {
  const ok = readApplicationFixture(contour.fixturePath);
  const belarusOk = readApplicationFixture(contour.belarusFixturePath);
  const usTaxResident = cloneJson(ok);
  usTaxResident.beneficiary.tax.usTaxResident = true;
  const invalidBoolean = cloneJson(ok);
  invalidBoolean.beneficiary.tax.usResident = "false";

  writeJson(
    path.join(rootDir, "samples/fl-nonresident.ok.json"),
    sample(contour, "FL nonresident valid application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-nonresident.belarus-no-adddoc-ok.json"),
    sample(contour, "FL nonresident Belarus valid application without migration document", belarusOk, {
      status: "OK",
      exact: true,
      issues: [],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-nonresident.us-tax-resident.json"),
    sample(contour, "FL nonresident US tax resident reject", usTaxResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "FL_NONRESIDENT.BEN.TAX.US_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.usTaxResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/fl-nonresident.invalid-boolean.json"),
    sample(contour, "FL nonresident invalid boolean tax flag", invalidBoolean, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.US_RESIDENT.BOOL", field: "beneficiary.tax.usResident", level: "EXCEPTION" }],
    }),
  );
}

function writeSamples() {
  writeResidentSamples(contours[0]);
  writeNonresidentSamples(contours[1]);
}

const sources = contours.map((contour) => ({ contour, source: readSource(contour) }));
const preparedContours = sources.map(({ contour, source }) => ({
  ...contour,
  artifacts: prepareArtifacts(source, contour),
}));
const { artifacts, reports } = mergeArtifacts(preparedContours);
const codeAliases = namespaceDuplicateCheckCodes(artifacts);

rmSync(path.join(rootDir, "rules"), { recursive: true, force: true });
rmSync(path.join(rootDir, "samples"), { recursive: true, force: true });

for (const artifact of artifacts) {
  writeJson(fileForArtifact(artifact), artifact);
}

const manifest = mergeCatalogs(
  sources.map(({ source }) => source),
  reports,
);
writeJson(path.join(rootDir, "manifest.json"), manifest);
writeSamples();
writeJson(path.join(rootDir, "docs/sync-report.json"), {
  processorDir: repoRelative(processorDir),
  contours: preparedContours.map((contour) => ({
    key: contour.key,
    type: contour.type,
    sourcePath: repoRelative(contour.sourcePath),
    sourceArtifacts: contour.artifacts.length,
    entrypointId: contour.entrypointId,
  })),
  mergeReports: reports,
  codeAliases,
  artifactCount: artifacts.length,
});

console.log(`Synced ${artifacts.length} artifacts from ${contours.length} processor snapshots`);
for (const report of reports) {
  console.log(
    `${report.contour}: shared=${report.shared}, added=${report.added}, scopedConflicts=${report.scopedConflicts}`,
  );
}
