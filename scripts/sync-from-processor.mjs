import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { customOperatorMeta } from "./operators.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const processorDir = process.env.PROCESSOR_REPO || path.resolve(rootDir, "../processor-preprod");
const sourcePath = path.join(
  processorDir,
  "artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
);
const fixturePath = path.join(
  processorDir,
  "fixtures/TC-009-valid-fl-resident-fias-no-addressline.json",
);

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

const taxFlagConfigs = [
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

function upsertArtifact(artifacts, artifact) {
  const index = artifacts.findIndex((item) => item.id === artifact.id);
  if (index >= 0) {
    artifacts[index] = artifact;
    return;
  }
  artifacts.push(artifact);
}

function refactorTaxFlagPipeline(artifacts) {
  const pipeline = artifacts.find((artifact) => artifact.id === "internal.fl_resident.blocks.tax_flags");
  if (!pipeline || !Array.isArray(pipeline.flow)) return;

  for (const config of taxFlagConfigs) {
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
  pipeline.flow = taxFlagConfigs.flatMap((config) => [
    { rule: config.requiredId },
    { condition: `library.tax.cond_${config.key}_type_if_present` },
    { condition: `internal.fl_resident.blocks.tax_flags.cond_${config.key}_not_true_if_boolean` },
  ]);
}

function addTaxFlagCatalog(manifest) {
  for (const config of taxFlagConfigs) {
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
  };

  for (const [id, [title, description]] of Object.entries(artifacts)) {
    manifest.catalog.artifacts[id] = { title, description };
  }
}

function fileForArtifact(artifact) {
  const parts = artifact.id.split(".");
  if (artifact.type === "dictionary") {
    return path.join(rootDir, "rules/dictionaries", `${artifact.id}.json`);
  }
  if (artifact.id.startsWith("entrypoints.fl_resident.full_validation.")) {
    return path.join(rootDir, "rules/entrypoints/fl_resident/checks", `${parts.at(-1)}.json`);
  }
  if (artifact.id === "entrypoints.fl_resident.full_validation") {
    return path.join(rootDir, "rules/entrypoints/fl_resident/full_validation.json");
  }
  if (artifact.id.startsWith("internal.fl_resident.")) {
    return path.join(rootDir, "rules/internal/fl_resident", ...parts.slice(2, -1), `${parts.at(-1)}.json`);
  }
  if (artifact.id.startsWith("library.")) {
    return path.join(rootDir, "rules/library", ...parts.slice(1, -1), `${parts.at(-1)}.json`);
  }
  return path.join(rootDir, "rules/other", ...parts.slice(0, -1), `${parts.at(-1)}.json`);
}

function sample(name, payload, expected) {
  return {
    name,
    context: {
      pipelineId: "entrypoints.fl_resident.full_validation",
      currentDate: "2026-04-12",
    },
    payload,
    expect: expected,
  };
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
let artifacts = cloneJson(source.artifacts);
normalizeKnownLegacyDuplicates(artifacts);
artifacts = replaceBooleanDictionaryWithOperator(artifacts);
refactorTaxFlagPipeline(artifacts);
rmSync(path.join(rootDir, "rules"), { recursive: true, force: true });
rmSync(path.join(rootDir, "samples"), { recursive: true, force: true });

for (const artifact of artifacts) {
  writeJson(fileForArtifact(artifact), artifact);
}

const sourceManifest = source.manifest || {};
const manifest = {
  project: {
    id: "nominal-beneficiaries-rules",
    version: "0.1.0",
    title: "Бенефициары номинальных счетов",
    description: "Пакет правил проверок заявок бенефициаров номинальных счетов. Первый слайс содержит FL_RESIDENT validate-application в режиме parity с processor-preprod.",
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
    ...(sourceManifest.catalog || {}),
    operators: {
      ...(sourceManifest.catalog?.operators || {}),
      ...customOperatorMeta(),
    },
  },
};
delete manifest.catalog.artifacts.true_false;
addTaxFlagCatalog(manifest);
addStudioPolishCatalog(manifest);
writeJson(path.join(rootDir, "manifest.json"), manifest);

const ok = JSON.parse(readFileSync(fixturePath, "utf8")).application;
const missingInn = JSON.parse(JSON.stringify(ok));
delete missingInn.beneficiary.inn;
const usTaxResident = JSON.parse(JSON.stringify(ok));
usTaxResident.beneficiary.tax.usTaxResident = true;
const futureIssueDate = JSON.parse(JSON.stringify(ok));
futureIssueDate.beneficiary.idDoc.issueDate = "2026-12-01";
const invalidBoolean = JSON.parse(JSON.stringify(ok));
invalidBoolean.beneficiary.tax.foreignTaxResident = "false";
const missingTaxFlag = JSON.parse(JSON.stringify(ok));
delete missingTaxFlag.beneficiary.tax.foreignTaxResident;

writeJson(
  path.join(rootDir, "samples/fl-resident.ok.json"),
  sample("FL resident valid application", ok, { status: "OK", exact: true, issues: [] }),
);
writeJson(
  path.join(rootDir, "samples/fl-resident.missing-inn.json"),
  sample("FL resident missing INN", missingInn, {
    status: "ERROR",
    exact: true,
    issues: [{ code: "FL.INN.REQUIRED", field: "beneficiary.inn", level: "ERROR" }],
  }),
);
writeJson(
  path.join(rootDir, "samples/fl-resident.us-tax-resident.json"),
  sample("FL resident US tax resident reject", usTaxResident, {
    status: "EXCEPTION",
    exact: true,
    issues: [{ code: "BEN.TAX.US_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.usTaxResident", level: "EXCEPTION" }],
  }),
);
writeJson(
  path.join(rootDir, "samples/fl-resident.future-issue-date.json"),
  sample("FL resident future document issue date", futureIssueDate, {
    status: "ERROR",
    exact: true,
    issues: [{ code: "BEN.IDDOC.ISSUE_DATE.NOT_FUTURE", field: "beneficiary.idDoc.issueDate", level: "ERROR" }],
  }),
);
writeJson(
  path.join(rootDir, "samples/fl-resident.invalid-boolean.json"),
  sample("FL resident invalid boolean tax flag", invalidBoolean, {
    status: "EXCEPTION",
    exact: true,
    issues: [{ code: "BEN.TAX.FOREIGN_TAX_RESIDENT.BOOL", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
  }),
);
writeJson(
  path.join(rootDir, "samples/fl-resident.missing-tax-flag.json"),
  {
    ...sample("FL resident missing tax flag", missingTaxFlag, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.FOREIGN_TAX_RESIDENT.REQUIRED", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
    }),
    legacyParity: false,
  },
);

console.log(`Synced ${artifacts.length} artifacts from ${sourcePath}`);
