import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { customOperatorMeta } from "./operators.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const processorDir = process.env.PROCESSOR_REPO || path.resolve(rootDir, "../processor-preprod");
const legacyFixtureDir = path.join(rootDir, "test-fixtures/legacy-snapshots");
const fieldContractDir = path.join(rootDir, "field-contracts");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));

const contours = [
  {
    key: "fl_resident",
    type: "FL_RESIDENT",
    label: "ФЛ-резидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/fl-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    legacyFixtureFile: "fl-resident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/fl-resident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "fl-resident.validate-application.rules-field-contract.json",
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
    legacyFixtureFile: "fl-nonresident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/fl-nonresident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "fl-nonresident.validate-application.rules-field-contract.json",
    fixturePath: path.join(processorDir, "fixtures/BEN-FL-NONRES-FOREIGN-PASSPORT-VALID.json"),
    belarusFixturePath: path.join(processorDir, "fixtures/BEN-FL-NONRES-BELARUS-NO-ADDDOC-VALID.json"),
    entrypointId: "entrypoints.fl_nonresident.full_validation",
    currentDate: "2026-05-18",
  },
  {
    key: "ip_resident",
    type: "IP_RESIDENT",
    label: "ИП-резидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/ip-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    legacyFixtureFile: "ip-resident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/ip-resident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "ip-resident.validate-application.rules-field-contract.json",
    fixturePath: path.join(processorDir, "fixtures/TC-009-valid-fl-resident-fias-no-addressline.json"),
    entrypointId: "entrypoints.ip_resident.full_validation",
    currentDate: "2026-06-03",
  },
  {
    key: "ip_nonresident",
    type: "IP_NONRESIDENT",
    label: "ИП-нерезидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/ip-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    legacyFixtureFile: "ip-nonresident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/ip-nonresident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "ip-nonresident.validate-application.rules-field-contract.json",
    fixturePath: path.join(processorDir, "fixtures/BEN-IP-NONRESIDENT-VALID.json"),
    entrypointId: "entrypoints.ip_nonresident.full_validation",
    currentDate: "2026-05-18",
  },
  {
    key: "ul_resident",
    type: "UL_RESIDENT",
    label: "ЮЛ-резидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/ul-resident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    legacyFixtureFile: "ul-resident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/ul-resident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "ul-resident.validate-application.rules-field-contract.json",
    entrypointId: "entrypoints.ul_resident.full_validation",
    currentDate: "2026-06-15",
  },
  {
    key: "ul_nonresident",
    type: "UL_NONRESIDENT",
    label: "ЮЛ-нерезидент",
    sourcePath: path.join(
      processorDir,
      "artifacts/ul-nonresident.registration/subflows/validate-application-v1/rules.snapshot.json",
    ),
    legacyFixtureFile: "ul-nonresident.validate-application.rules.snapshot.json",
    fieldContractPath: path.join(
      processorDir,
      "artifacts/ul-nonresident.registration/subflows/validate-application-v1/rules-field-contract.json",
    ),
    fieldContractFile: "ul-nonresident.validate-application.rules-field-contract.json",
    entrypointId: "entrypoints.ul_nonresident.full_validation",
    currentDate: "2026-06-15",
  },
  {
    key: "beneficiary_unbind",
    type: "BENEFICIARY_UNBIND",
    label: "отвязка бенефициара",
    sourcePath: path.join(processorDir, "artifacts/beneficiary.unbind/rules.snapshot.json"),
    legacyFixtureFile: "beneficiary-unbind.rules.snapshot.json",
    fieldContractPath: path.join(processorDir, "artifacts/beneficiary.unbind/rules-field-contract.json"),
    fieldContractFile: "beneficiary-unbind.rules-field-contract.json",
    entrypointId: "entrypoints.beneficiary.unbind.field_validation",
    entrypointIds: [
      "entrypoints.beneficiary.unbind.type_supported",
      "entrypoints.beneficiary.unbind.field_validation",
    ],
    currentDate: "2026-06-15",
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

const ulCommonStatusIdMap = {
  "library.common.status_end_format": "library.ul.common.status_end_format",
  "library.common.status_end_gt_start": "library.ul.common.status_end_gt_start",
  "library.common.cond_status_end_if_present": "library.ul.common.cond_status_end_if_present",
  "library.common.cond_status_end_order_if_format_ok": "library.ul.common.cond_status_end_order_if_format_ok",
};

const unbindFieldPipelineId = "entrypoints.beneficiary.unbind.field_validation";
const unbindTypePipelineId = "entrypoints.beneficiary.unbind.type_supported";

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

function normalizeBeneficiaryTypesDictionary(artifacts) {
  for (const artifact of artifacts) {
    if (artifact.id === "beneficiary_types" && artifact.type === "dictionary") {
      artifact.description = "Допустимые категории бенефициаров для версии 1";
    }
  }
}

function refactorUlCommonStatus(artifacts, contour) {
  if (!["ul_resident", "ul_nonresident"].includes(contour.key)) return artifacts;

  return artifacts.map((artifact) => {
    const rewritten = rewriteIds(artifact, ulCommonStatusIdMap);
    switch (rewritten.id) {
      case "library.ul.common.status_end_format":
        rewritten.description = "Дата окончания участия должна быть в формате YYYY-MM-DD";
        break;
      case "library.ul.common.status_end_gt_start":
        rewritten.description = "Дата окончания участия должна быть позже даты начала";
        break;
      case "library.ul.common.cond_status_end_if_present":
        rewritten.description = "Если дата окончания участия указана, проверяем формат и порядок дат";
        break;
      case "library.ul.common.cond_status_end_order_if_format_ok":
        rewritten.description = "Если формат даты окончания участия корректен, проверяем порядок дат";
        break;
      default:
        break;
    }
    return rewritten;
  });
}

function refactorBeneficiaryUnbindScope(artifacts, contour) {
  if (contour.key !== "beneficiary_unbind") return artifacts;

  const idMap = {};
  for (const artifact of artifacts) {
    if (!artifact.id.startsWith("beneficiary.unbind.")) continue;
    const localName = artifact.id.replace("beneficiary.unbind.", "");
    const pipelineId = localName === "type_supported" ? unbindTypePipelineId : unbindFieldPipelineId;
    idMap[artifact.id] = `${pipelineId}.${localName}`;
  }

  return artifacts.map((artifact) => rewriteIds(artifact, idMap));
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

function addIpNonresidentCatalog(manifest) {
  Object.assign(manifest.catalog.fields, {
    "beneficiary.ip.fullName": {
      title: "Полное наименование ИП",
      description: "Полное наименование индивидуального предпринимателя",
    },
    "beneficiary.ip.shortName": {
      title: "Краткое наименование ИП",
      description: "Краткое наименование индивидуального предпринимателя",
    },
    "beneficiary.ip.registration.number": {
      title: "ОГРНИП",
      description: "Государственный регистрационный номер индивидуального предпринимателя",
    },
    "beneficiary.ip.registration.date": {
      title: "Дата госрегистрации ИП",
      description: "Дата государственной регистрации индивидуального предпринимателя",
    },
    "beneficiary.ip.registration.agency": {
      title: "Регистрирующий орган ИП",
      description: "Наименование органа, зарегистрировавшего индивидуального предпринимателя",
    },
    "beneficiary.ip.registration.agencyCode": {
      title: "Код регистрирующего органа ИП",
      description: "Код органа, зарегистрировавшего индивидуального предпринимателя",
    },
    "beneficiary.ip.registration.agencyAddress": {
      title: "Адрес регистрирующего органа ИП",
      description: "Адрес органа, зарегистрировавшего индивидуального предпринимателя",
    },
  });

  Object.assign(manifest.catalog.artifacts, {
    "internal.ip_nonresident.blocks.ip_registration": {
      title: "Регистрационные данные ИП",
      description: "Проверяет наименование и регистрационные реквизиты ИП-нерезидента",
    },
    "internal.ip_nonresident.blocks.ip_registration.full_name_required": {
      title: "Полное наименование ИП указано",
      description: "Проверяет, что полное наименование индивидуального предпринимателя заполнено",
    },
    "internal.ip_nonresident.blocks.ip_registration.short_name_required": {
      title: "Краткое наименование ИП указано",
      description: "Проверяет, что краткое наименование индивидуального предпринимателя заполнено",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_number_required": {
      title: "ОГРНИП указан",
      description: "Проверяет, что ОГРНИП индивидуального предпринимателя заполнен",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_number_format": {
      title: "ОГРНИП содержит 15 цифр",
      description: "Проверяет формат ОГРНИП индивидуального предпринимателя",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_date_required": {
      title: "Дата госрегистрации ИП указана",
      description: "Проверяет, что дата государственной регистрации индивидуального предпринимателя заполнена",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_date_format": {
      title: "Дата госрегистрации ИП в формате YYYY-MM-DD",
      description: "Проверяет формат даты государственной регистрации индивидуального предпринимателя",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_agency_required": {
      title: "Регистрирующий орган ИП указан",
      description: "Проверяет, что наименование регистрирующего органа заполнено",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_agency_code_required": {
      title: "Код регистрирующего органа ИП указан",
      description: "Проверяет, что код регистрирующего органа заполнен",
    },
    "internal.ip_nonresident.blocks.ip_registration.registration_agency_address_required": {
      title: "Адрес регистрирующего органа ИП указан",
      description: "Проверяет, что адрес регистрирующего органа заполнен",
    },
    "library.ip_nonresident.address.cond_registration_fias_structure_for_ru": {
      title: "Если адрес ИП-нерезидента в РФ, проверяем структуру ФИАС",
      description: "Для российского адреса ИП-нерезидента проверяет обязательные структурные поля адреса",
    },
    "library.ip_nonresident.nonresident.add_doc_issuer_required": {
      title: "Кем выдан дополнительный документ указано",
      description: "Проверяет, что для дополнительного документа указан выдавший орган",
    },
    "library.ip_nonresident.nonresident.cond_add_doc_right_to_stay_doc": {
      title: "Если указан документ на право пребывания, проверяем его поля",
      description: "Проверяет обязательные поля документа на право пребывания или проживания",
    },
  });
}

function addUlResidentCatalog(manifest) {
  Object.assign(manifest.catalog.artifacts, {
    "internal.ul_resident.blocks.core": {
      title: "Основные сведения заявки ЮЛ-резидента",
      description: "Проверяет ИНН, основание участия, номер счета и даты участия",
    },
    "internal.ul_resident.blocks.contacts": {
      title: "Контакты ЮЛ-резидента",
      description: "Проверяет, что в заявке указан телефон или эл. почта",
    },
    "internal.ul_resident.blocks.address": {
      title: "Юридический адрес ЮЛ-резидента",
      description: "Проверяет наличие юридического адреса и страну адреса",
    },
    "internal.ul_resident.blocks.tax_flags": {
      title: "Налоговые и регуляторные признаки ЮЛ-резидента",
      description: "Проверяет обязательные признаки и запрет положительных значений",
    },
    "library.ul.type_required": {
      title: "Категория бенефициара указана",
      description: "Проверяет, что в заявке указана категория бенефициара",
    },
    "library.ul.type_supported": {
      title: "Категория бенефициара поддерживается",
      description: "Проверяет, что категория бенефициара входит в поддерживаемый справочник",
    },
    "library.ul.type_is_ul_resident": {
      title: "Заявка на ЮЛ-резидента",
      description: "Проверяет, что заявка относится к ЮЛ-резиденту",
    },
    "library.ul.inn_required": {
      title: "ИНН юридического лица указан",
      description: "Проверяет, что ИНН юридического лица заполнен",
    },
    "library.ul.inn_format_10": {
      title: "ИНН юридического лица содержит 10 цифр",
      description: "Проверяет длину и цифровой формат ИНН юридического лица",
    },
    "library.ul.inn_valid": {
      title: "ИНН юридического лица корректен",
      description: "Проверяет контрольный разряд ИНН юридического лица",
    },
    "library.ul.participation_id_required": {
      title: "Основание участия указано",
      description: "Проверяет, что идентификатор основания участия заполнен",
    },
    "library.ul.account_number_required": {
      title: "Номер номинального счета указан",
      description: "Проверяет, что номер номинального счета заполнен",
    },
    "library.ul.account_number_format": {
      title: "Номер номинального счета содержит 20 цифр",
      description: "Проверяет формат номера номинального счета",
    },
    "library.ul.status_start_required": {
      title: "Дата начала участия указана",
      description: "Проверяет, что дата начала участия бенефициара заполнена",
    },
    "library.ul.status_start_format": {
      title: "Дата начала участия в формате YYYY-MM-DD",
      description: "Проверяет формат даты начала участия бенефициара",
    },
    "library.ul.contacts_any": {
      title: "Телефон или эл. почта указаны",
      description: "Проверяет, что указан хотя бы один контакт ЮЛ-резидента",
    },
    "library.ul.legal_address_required": {
      title: "Юридический адрес указан",
      description: "Проверяет, что юридический адрес ЮЛ-резидента заполнен",
    },
    "library.ul.legal_address_country_required": {
      title: "Страна юридического адреса указана",
      description: "Проверяет, что страна юридического адреса заполнена",
    },
    "library.ul.legal_address_country_ru": {
      title: "Юридический адрес находится в России",
      description: "Проверяет, что страна юридического адреса ЮЛ-резидента — Россия",
    },
    "library.ul.tax.foreign_required": {
      title: "Признак иностранного налогового резидентства указан",
      description: "Проверяет, что признак иностранного налогового резидентства заполнен",
    },
    "library.ul.tax.foreign_not_true": {
      title: "ЮЛ-резидент не является иностранным налоговым резидентом",
      description: "Проверяет, что признак иностранного налогового резидентства не имеет значение true",
    },
    "library.ul.tax.passive_nfe_required": {
      title: "Признак пассивной нефинансовой организации указан",
      description: "Проверяет, что признак пассивной нефинансовой организации заполнен",
    },
    "library.ul.tax.passive_nfe_not_true": {
      title: "ЮЛ-резидент не является пассивной нефинансовой организацией",
      description: "Проверяет, что признак пассивной нефинансовой организации не имеет значение true",
    },
    "library.ul.tax.cp_foreign_required": {
      title: "Признак контролирующих лиц с иностранным налоговым резидентством указан",
      description: "Проверяет, что признак контролирующих лиц с иностранным налоговым резидентством заполнен",
    },
    "library.ul.tax.cp_foreign_not_true": {
      title: "Нет контролирующих лиц с иностранным налоговым резидентством",
      description: "Проверяет, что признак контролирующих лиц с иностранным налоговым резидентством не имеет значение true",
    },
    "library.ul.tax.us_required": {
      title: "Признак налогового резидентства США указан",
      description: "Проверяет, что признак налогового резидентства США заполнен",
    },
    "library.ul.tax.us_not_true": {
      title: "ЮЛ-резидент не является налоговым резидентом США",
      description: "Проверяет, что признак налогового резидентства США не имеет значение true",
    },
    "library.ul.tax.cp_us_required": {
      title: "Признак контролирующих лиц с налоговым резидентством США указан",
      description: "Проверяет, что признак контролирующих лиц с налоговым резидентством США заполнен",
    },
    "library.ul.tax.cp_us_not_true": {
      title: "Нет контролирующих лиц с налоговым резидентством США",
      description: "Проверяет, что признак контролирующих лиц с налоговым резидентством США не имеет значение true",
    },
  });
}

function addUlCommonCatalog(manifest) {
  Object.assign(manifest.catalog.artifacts, {
    "library.ul.common.cond_status_end_if_present": {
      title: "Если дата окончания участия указана, проверяем ее формат",
      description: "Проверяет дату окончания участия только когда она заполнена в заявке",
    },
    "library.ul.common.cond_status_end_order_if_format_ok": {
      title: "Если даты участия указаны корректно, проверяем их порядок",
      description: "Проверяет порядок дат участия только после проверки формата даты окончания",
    },
    "library.ul.common.status_end_format": {
      title: "Дата окончания участия в формате YYYY-MM-DD",
      description: "Проверяет формат даты окончания участия бенефициара",
    },
    "library.ul.common.status_end_gt_start": {
      title: "Дата окончания участия позже даты начала",
      description: "Проверяет, что дата окончания участия позже даты начала участия",
    },
  });
}

function addUlNonresidentCatalog(manifest) {
  Object.assign(manifest.catalog.artifacts, {
    "entrypoints.ul_nonresident.full_validation": {
      title: "Валидация заявки ЮЛ-нерезидента",
      description: "Проверяет первичную заявку на регистрацию и привязку ЮЛ-нерезидента",
    },
    "internal.ul_nonresident.blocks.core": {
      title: "Основные сведения заявки ЮЛ-нерезидента",
      description: "Проверяет основание участия, номер счета и даты участия",
    },
    "internal.ul_nonresident.blocks.contacts": {
      title: "Контакты ЮЛ-нерезидента",
      description: "Проверяет, что в заявке указан телефон или эл. почта",
    },
    "internal.ul_nonresident.blocks.ul": {
      title: "Сведения о юридическом лице-нерезиденте",
      description: "Проверяет наименование, страну регистрации, ИНН или КИО, КПП и регистрационные данные",
    },
    "internal.ul_nonresident.blocks.address": {
      title: "Юридический адрес ЮЛ-нерезидента",
      description: "Проверяет наличие юридического адреса и иностранную страну адреса",
    },
    "internal.ul_nonresident.blocks.tax": {
      title: "Налоговые и регуляторные признаки ЮЛ-нерезидента",
      description: "Проверяет иностранное налоговое резидентство, FATCA/CRS признаки и данные налогового резидентства",
    },
    "library.ul_nonresident.type_required": {
      title: "Категория бенефициара указана",
      description: "Проверяет, что в заявке указана категория бенефициара",
    },
    "library.ul_nonresident.type_supported": {
      title: "Категория бенефициара поддерживается",
      description: "Проверяет, что категория бенефициара входит в поддерживаемый справочник",
    },
    "library.ul_nonresident.type_is_ul_nonresident": {
      title: "Заявка на ЮЛ-нерезидента",
      description: "Проверяет, что заявка относится к ЮЛ-нерезиденту",
    },
    "library.ul_nonresident.participation_id_required": {
      title: "Основание участия указано",
      description: "Проверяет, что основание участия бенефициара заполнено",
    },
    "library.ul_nonresident.account_number_required": {
      title: "Номер номинального счета указан",
      description: "Проверяет, что номер номинального счета заполнен",
    },
    "library.ul_nonresident.account_number_format": {
      title: "Номер номинального счета содержит 20 цифр",
      description: "Проверяет формат номера номинального счета",
    },
    "library.ul_nonresident.status_start_required": {
      title: "Дата начала участия указана",
      description: "Проверяет, что дата начала участия бенефициара заполнена",
    },
    "library.ul_nonresident.status_start_format": {
      title: "Дата начала участия в формате YYYY-MM-DD",
      description: "Проверяет формат даты начала участия бенефициара",
    },
    "library.ul_nonresident.contacts_any": {
      title: "Телефон или эл. почта указаны",
      description: "Проверяет, что указан хотя бы один контакт ЮЛ-нерезидента",
    },
    "library.ul_nonresident.inn_or_kio_any": {
      title: "ИНН или КИО указаны",
      description: "Проверяет, что для ЮЛ-нерезидента указан российский ИНН или КИО",
    },
    "library.ul_nonresident.pred_inn_present": {
      title: "ИНН указан",
      description: "Проверяет наличие ИНН перед зависимыми проверками",
    },
    "library.ul_nonresident.cond_inn_if_present": {
      title: "Если ИНН указан, проверяем его",
      description: "Запускает проверки ИНН только когда ИНН заполнен",
    },
    "library.ul_nonresident.inn_format_10": {
      title: "ИНН юридического лица содержит 10 цифр",
      description: "Проверяет длину и цифровой формат ИНН юридического лица",
    },
    "library.ul_nonresident.inn_mask_9909": {
      title: "ИНН ЮЛ-нерезидента начинается с 9909",
      description: "Проверяет специальную маску ИНН для ЮЛ-нерезидента",
    },
    "library.ul_nonresident.inn_valid": {
      title: "ИНН юридического лица корректен",
      description: "Проверяет контрольный разряд ИНН юридического лица",
    },
    "library.ul_nonresident.pred_kio_present": {
      title: "КИО указан",
      description: "Проверяет наличие КИО перед зависимой проверкой",
    },
    "library.ul_nonresident.cond_kio_if_present": {
      title: "Если КИО указан, проверяем его",
      description: "Запускает проверку КИО только когда КИО заполнен",
    },
    "library.ul_nonresident.kio_format": {
      title: "КИО содержит 5 цифр",
      description: "Проверяет формат КИО ЮЛ-нерезидента",
    },
    "library.ul_nonresident.kpp_required": {
      title: "КПП указан",
      description: "Проверяет, что КПП ЮЛ-нерезидента заполнен",
    },
    "library.ul_nonresident.kpp_format": {
      title: "КПП содержит 9 цифр",
      description: "Проверяет формат КПП ЮЛ-нерезидента",
    },
    "library.ul_nonresident.full_name_required": {
      title: "Полное наименование указано",
      description: "Проверяет, что полное наименование юридического лица заполнено",
    },
    "library.ul_nonresident.foreign_full_name_required": {
      title: "Иностранное полное наименование указано",
      description: "Проверяет, что иностранное полное наименование юридического лица заполнено",
    },
    "library.ul_nonresident.country_required": {
      title: "Страна регистрации указана",
      description: "Проверяет, что страна регистрации юридического лица заполнена",
    },
    "library.ul_nonresident.country_format_non_ru": {
      title: "Страна регистрации не Россия",
      description: "Проверяет, что страна регистрации ЮЛ-нерезидента не равна RU",
    },
    "library.ul_nonresident.registration_number_required": {
      title: "Регистрационный номер указан",
      description: "Проверяет, что регистрационный номер юридического лица заполнен",
    },
    "library.ul_nonresident.registration_date_required": {
      title: "Дата регистрации указана",
      description: "Проверяет, что дата регистрации юридического лица заполнена",
    },
    "library.ul_nonresident.registration_date_format": {
      title: "Дата регистрации в формате YYYY-MM-DD",
      description: "Проверяет формат даты регистрации юридического лица",
    },
    "library.ul_nonresident.registration_agency_required": {
      title: "Регистрирующий орган указан",
      description: "Проверяет, что регистрирующий орган юридического лица заполнен",
    },
    "library.ul_nonresident.registration_place_required": {
      title: "Место регистрации указано",
      description: "Проверяет, что место регистрации юридического лица заполнено",
    },
    "library.ul_nonresident.legal_address_required": {
      title: "Юридический адрес указан",
      description: "Проверяет, что юридический адрес ЮЛ-нерезидента заполнен",
    },
    "library.ul_nonresident.legal_address_country_required": {
      title: "Страна юридического адреса указана",
      description: "Проверяет, что страна юридического адреса заполнена",
    },
    "library.ul_nonresident.legal_address_country_format_non_ru": {
      title: "Юридический адрес находится не в России",
      description: "Проверяет, что страна юридического адреса ЮЛ-нерезидента не равна RU",
    },
    "library.ul_nonresident.tax.foreign_required": {
      title: "Признак иностранного налогового резидентства указан",
      description: "Проверяет, что признак иностранного налогового резидентства заполнен",
    },
    "library.ul_nonresident.tax.foreign_true": {
      title: "ЮЛ-нерезидент является иностранным налоговым резидентом",
      description: "Проверяет, что признак иностранного налогового резидентства имеет значение true",
    },
    "library.ul_nonresident.tax.foreign_residency_country_required": {
      title: "Страна налогового резидентства указана",
      description: "Проверяет, что страна иностранного налогового резидентства заполнена",
    },
    "library.ul_nonresident.tax.foreign_residency_tin_required": {
      title: "Иностранный налоговый номер указан",
      description: "Проверяет, что иностранный налоговый номер заполнен",
    },
    "library.ul_nonresident.tax.passive_nfe_required": {
      title: "Признак пассивной нефинансовой организации указан",
      description: "Проверяет, что признак пассивной нефинансовой организации заполнен",
    },
    "library.ul_nonresident.tax.passive_nfe_not_true": {
      title: "ЮЛ-нерезидент не является пассивной нефинансовой организацией",
      description: "Проверяет, что признак пассивной нефинансовой организации не имеет значение true",
    },
    "library.ul_nonresident.tax.cp_foreign_required": {
      title: "Признак контролирующих лиц с иностранным налоговым резидентством указан",
      description: "Проверяет, что признак контролирующих лиц с иностранным налоговым резидентством заполнен",
    },
    "library.ul_nonresident.tax.cp_foreign_not_true": {
      title: "Нет контролирующих лиц с иностранным налоговым резидентством",
      description: "Проверяет, что признак контролирующих лиц с иностранным налоговым резидентством не имеет значение true",
    },
    "library.ul_nonresident.tax.us_required": {
      title: "Признак налогового резидентства США указан",
      description: "Проверяет, что признак налогового резидентства США заполнен",
    },
    "library.ul_nonresident.tax.us_not_true": {
      title: "ЮЛ-нерезидент не является налоговым резидентом США",
      description: "Проверяет, что признак налогового резидентства США не имеет значение true",
    },
    "library.ul_nonresident.tax.cp_us_required": {
      title: "Признак контролирующих лиц с налоговым резидентством США указан",
      description: "Проверяет, что признак контролирующих лиц с налоговым резидентством США заполнен",
    },
    "library.ul_nonresident.tax.cp_us_not_true": {
      title: "Нет контролирующих лиц с налоговым резидентством США",
      description: "Проверяет, что признак контролирующих лиц с налоговым резидентством США не имеет значение true",
    },
  });
}

function addUnbindCatalog(manifest) {
  Object.assign(manifest.catalog.fields, {
    "beneficiary.type": {
      ...(manifest.catalog.fields["beneficiary.type"] || {}),
      title: "Категория бенефициара",
      btName: "Категория бенефициара",
      description: "Категория бенефициара в заявке",
      businessDescription: "Категория бенефициара",
    },
    "beneficiary.participationId": {
      ...(manifest.catalog.fields["beneficiary.participationId"] || {}),
      title: "Идентификатор участия",
      btName: "Идентификатор участия",
      description: "Идентификатор участия бенефициара в номинальном счете",
      businessDescription: "Идентификатор участия",
    },
    "beneficiary.inn": {
      ...(manifest.catalog.fields["beneficiary.inn"] || {}),
      title: "ИНН бенефициара",
      btName: "ИНН бенефициара",
      description: "ИНН бенефициара",
      businessDescription: "ИНН бенефициара",
    },
    "beneficiary.account.number": {
      ...(manifest.catalog.fields["beneficiary.account.number"] || {}),
      title: "Номер номинального счета",
      btName: "Номер номинального счета",
      description: "Номер номинального счета",
      businessDescription: "Номер номинального счета",
    },
    "beneficiary.status.startDate": {
      ...(manifest.catalog.fields["beneficiary.status.startDate"] || {}),
      title: "Дата присоединения",
      btName: "Дата присоединения",
      description: "Дата присоединения бенефициара к номинальному счету",
      businessDescription: "Дата присоединения",
    },
    "beneficiary.status.endDate": {
      ...(manifest.catalog.fields["beneficiary.status.endDate"] || {}),
      title: "Дата выбытия",
      btName: "Дата выбытия",
      description: "Дата выбытия бенефициара из номинального счета",
      businessDescription: "Дата выбытия",
    },
  });

  Object.assign(manifest.catalog.entrypoints, {
    "entrypoints.beneficiary.unbind.type_supported": {
      title: "Проверка категории бенефициара для отвязки",
      description: "Проверяет, что заявка на отвязку относится к поддерживаемой категории бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation": {
      title: "Валидация заявки на отвязку",
      description: "Проверяет обязательные данные заявки на отвязку бенефициара от номинального счета",
    },
  });

  Object.assign(manifest.catalog.artifacts, {
    "entrypoints.beneficiary.unbind.type_supported": {
      title: "Проверка категории бенефициара для отвязки",
      description: "Проверяет, что заявка на отвязку относится к поддерживаемой категории бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation": {
      title: "Валидация заявки на отвязку",
      description: "Проверяет обязательные данные заявки на отвязку бенефициара от номинального счета",
    },
    "entrypoints.beneficiary.unbind.type_supported.type_supported": {
      title: "Категория бенефициара поддерживается для отвязки",
      description: "Проверяет, что категория бенефициара допускает отвязку от номинального счета",
    },
    "entrypoints.beneficiary.unbind.field_validation.participation_id_present": {
      title: "Идентификатор участия указан",
      description: "Проверяет, что в заявке указан идентификатор участия бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.inn_present": {
      title: "ИНН бенефициара указан",
      description: "Проверяет, что в заявке указан ИНН бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.inn_format": {
      title: "ИНН бенефициара содержит 10 или 12 цифр",
      description: "Проверяет формат ИНН бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.inn_valid": {
      title: "ИНН бенефициара корректен",
      description: "Проверяет контрольные разряды ИНН бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.account_present": {
      title: "Номер номинального счета указан",
      description: "Проверяет, что в заявке указан номер номинального счета",
    },
    "entrypoints.beneficiary.unbind.field_validation.start_date_present": {
      title: "Дата присоединения указана",
      description: "Проверяет, что в заявке указана дата присоединения бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.start_date_format": {
      title: "Дата присоединения в формате YYYY-MM-DD",
      description: "Проверяет формат даты присоединения бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.end_date_present": {
      title: "Дата выбытия указана",
      description: "Проверяет, что в заявке указана дата выбытия бенефициара",
    },
    "entrypoints.beneficiary.unbind.field_validation.end_date_format": {
      title: "Дата выбытия в формате YYYY-MM-DD",
      description: "Проверяет формат даты выбытия бенефициара",
    },
  });
}

function addScopedConflictCatalog(manifest, report) {
  const contour = contours.find((item) => item.key === report.contour);
  const suffix = contour?.label ? `Версия правила для ${contour.label}.` : "Контурная версия правила.";

  for (const [sourceId, scopedId] of Object.entries(report.conflictMap)) {
    const sourceMeta = manifest.catalog.artifacts[sourceId];
    if (sourceMeta && !manifest.catalog.artifacts[scopedId]) {
      manifest.catalog.artifacts[scopedId] = {
        ...sourceMeta,
        description: `${sourceMeta.description || sourceMeta.title}. ${suffix}`,
      };
    }
  }
}

function readSource(contour) {
  const sourceText = readFileSync(contour.sourcePath, "utf8");
  const source = JSON.parse(sourceText);
  mkdirSync(legacyFixtureDir, { recursive: true });
  writeFileSync(path.join(legacyFixtureDir, contour.legacyFixtureFile), sourceText);
  mkdirSync(fieldContractDir, { recursive: true });
  writeFileSync(path.join(fieldContractDir, contour.fieldContractFile), readFileSync(contour.fieldContractPath, "utf8"));
  return source;
}

function prepareArtifacts(source, contour) {
  let artifacts = cloneJson(source.artifacts);
  normalizeKnownLegacyDuplicates(artifacts);
  normalizeBeneficiaryTypesDictionary(artifacts);
  artifacts = replaceBooleanDictionaryWithOperator(artifacts);
  artifacts = refactorUlCommonStatus(artifacts, contour);
  artifacts = refactorBeneficiaryUnbindScope(artifacts, contour);
  if (contour.key === "fl_resident") {
    refactorResidentTaxFlagPipeline(artifacts);
  }
  return artifacts;
}

function buildConflictMap(baseArtifacts, nextArtifacts, contour) {
  const result = {};
  const byId = new Map(baseArtifacts.map((artifact) => [artifact.id, artifact]));

  for (const artifact of nextArtifacts) {
    if (artifact.id.startsWith("internal.") && !artifact.id.startsWith(`internal.${contour.key}.`)) {
      result[artifact.id] = scopedArtifactId(artifact, contour);
      continue;
    }

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
  if (artifact.id.startsWith("internal.")) {
    return `internal.${contour.key}.${artifact.id.replace(/^internal\.[^.]+\./, "")}`;
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
    const prefix = artifact.id.includes("fl_nonresident")
      ? "FL_NONRESIDENT"
      : artifact.id.includes("ip_resident")
        ? "IP_RESIDENT"
        : artifact.id.includes("ip_nonresident")
          ? "IP_NONRESIDENT"
          : artifact.id.includes("library.ul.")
            ? "UL"
            : artifact.id.includes("ul_resident")
              ? "UL_RESIDENT"
              : artifact.id.includes("ul_nonresident")
                ? "UL_NONRESIDENT"
                : "RULESET";
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
      version: packageJson.version,
      title: "Бенефициары номинальных счетов",
      description: "Пакет правил проверок бенефициаров номинальных счетов. Текущий slice содержит FL_RESIDENT, FL_NONRESIDENT, IP_RESIDENT, IP_NONRESIDENT, UL_RESIDENT, UL_NONRESIDENT validate-application и beneficiary.unbind в режиме parity с processor-preprod.",
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
    addScopedConflictCatalog(manifest, report);
  }

  manifest.catalog.operators = {
    ...manifest.catalog.operators,
    ...customOperatorMeta(),
  };
  delete manifest.catalog.artifacts.true_false;
  addResidentTaxFlagCatalog(manifest);
  addStudioPolishCatalog(manifest);
  addIpNonresidentCatalog(manifest);
  addUlCommonCatalog(manifest);
  addUlResidentCatalog(manifest);
  addUlNonresidentCatalog(manifest);
  addUnbindCatalog(manifest);

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
    if ((contour.entrypointIds || [contour.entrypointId]).includes(artifact.id)) {
      if (contour.key === "beneficiary_unbind") {
        return path.join(rootDir, "rules/entrypoints", contour.key, `${parts.at(-1)}.json`);
      }
      return path.join(rootDir, "rules/entrypoints", contour.key, "full_validation.json");
    }
    for (const entrypointId of contour.entrypointIds || [contour.entrypointId]) {
      if (artifact.id.startsWith(`${entrypointId}.library.`)) {
        const scopedParts = artifact.id.slice(`${entrypointId}.library.`.length).split(".");
        return path.join(rootDir, "rules/entrypoints", contour.key, "library", ...scopedParts.slice(0, -1), `${scopedParts.at(-1)}.json`);
      }
      if (artifact.id.startsWith(`${entrypointId}.`)) {
        return path.join(rootDir, "rules/entrypoints", contour.key, "checks", `${parts.at(-1)}.json`);
      }
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

function sampleWithPipeline(contour, pipelineId, name, payload, expected, extra = {}) {
  return {
    name,
    context: {
      pipelineId,
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

function writeIpResidentSamples(contour) {
  const ok = readApplicationFixture(contour.fixturePath);
  ok.beneficiary.type = "IP_RESIDENT";
  const missingInn = cloneJson(ok);
  delete missingInn.beneficiary.inn;
  const usResident = cloneJson(ok);
  usResident.beneficiary.tax.usResident = true;
  const foreignTaxResident = cloneJson(ok);
  foreignTaxResident.beneficiary.tax.foreignTaxResident = true;
  const invalidBoolean = cloneJson(ok);
  invalidBoolean.beneficiary.tax.usTaxResident = "false";

  writeJson(
    path.join(rootDir, "samples/ip-resident.ok.json"),
    sample(contour, "IP resident valid owner application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-resident.missing-inn.json"),
    sample(contour, "IP resident missing INN", missingInn, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "FL.INN.REQUIRED", field: "beneficiary.inn", level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-resident.us-resident.json"),
    sample(contour, "IP resident US resident reject", usResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "IP_RESIDENT.BEN.TAX.US_RESIDENT.NOT_TRUE", field: "beneficiary.tax.usResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-resident.foreign-tax-resident.json"),
    sample(contour, "IP resident foreign tax resident reject", foreignTaxResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "IP_RESIDENT.BEN.TAX.FOREIGN_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-resident.invalid-boolean.json"),
    sample(contour, "IP resident invalid boolean tax flag", invalidBoolean, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.US_TAX_RESIDENT.BOOL", field: "beneficiary.tax.usTaxResident", level: "EXCEPTION" }],
    }),
  );
}

function writeIpNonresidentSamples(contour) {
  const ok = readApplicationFixture(contour.fixturePath);
  const usTaxResident = cloneJson(ok);
  usTaxResident.beneficiary.tax.usTaxResident = true;
  const invalidBoolean = cloneJson(ok);
  invalidBoolean.beneficiary.tax.usResident = "false";
  const missingRegistrationNumber = cloneJson(ok);
  delete missingRegistrationNumber.beneficiary.ip.registration.number;
  const invalidRegistrationNumber = cloneJson(ok);
  invalidRegistrationNumber.beneficiary.ip.registration.number = "123";

  writeJson(
    path.join(rootDir, "samples/ip-nonresident.ok.json"),
    sample(contour, "IP nonresident valid application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-nonresident.us-tax-resident.json"),
    sample(contour, "IP nonresident US tax resident reject", usTaxResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "IP_NONRESIDENT.BEN.TAX.US_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.usTaxResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-nonresident.invalid-boolean.json"),
    sample(contour, "IP nonresident invalid boolean tax flag", invalidBoolean, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "BEN.TAX.US_RESIDENT.BOOL", field: "beneficiary.tax.usResident", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-nonresident.missing-registration-number.json"),
    sample(contour, "IP nonresident missing registration number", missingRegistrationNumber, {
      status: "ERROR",
      exact: true,
      issues: [
        { code: "IP.REGISTRATION_NUMBER.REQUIRED", field: "beneficiary.ip.registration.number", level: "ERROR" },
        { code: "IP.REGISTRATION_NUMBER.FORMAT", field: "beneficiary.ip.registration.number", level: "ERROR" },
      ],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ip-nonresident.invalid-registration-number.json"),
    sample(contour, "IP nonresident invalid registration number", invalidRegistrationNumber, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "IP.REGISTRATION_NUMBER.FORMAT", field: "beneficiary.ip.registration.number", level: "ERROR" }],
    }),
  );
}

function ulResidentApplication(overrides = {}) {
  const beneficiaryOverrides = overrides.beneficiary || {};
  const application = {
    beneficiary: {
      type: "UL_RESIDENT",
      inn: "6454122829",
      participationId: "UL-PARTICIPATION-0001",
      account: { number: "40702810120028000006" },
      contacts: { phone: "9801611004" },
      status: { startDate: "2026-06-15" },
      address: { legal: { countryCode: "RU", fullAddress: "410028, Саратов" } },
      tax: {
        foreignTaxResident: false,
        passiveNfe: false,
        controllingPersonsForeignTaxResident: false,
        usTaxResident: false,
        controllingPersonsUsTaxResident: false,
      },
    },
  };

  application.beneficiary = {
    ...application.beneficiary,
    ...beneficiaryOverrides,
  };
  return application;
}

function writeUlResidentSamples(contour) {
  const ok = ulResidentApplication();
  const noContacts = ulResidentApplication({
    beneficiary: {
      contacts: {
        phone: "",
        email: "",
      },
    },
  });
  const foreignLegalAddress = ulResidentApplication({
    beneficiary: {
      address: {
        legal: {
          countryCode: "KZ",
          fullAddress: "Казахстан, Алматы",
        },
      },
    },
  });
  const foreignTaxResident = ulResidentApplication({
    beneficiary: {
      tax: {
        foreignTaxResident: true,
        passiveNfe: false,
        controllingPersonsForeignTaxResident: false,
        usTaxResident: false,
        controllingPersonsUsTaxResident: false,
      },
    },
  });

  writeJson(
    path.join(rootDir, "samples/ul-resident.ok.json"),
    sample(contour, "UL resident valid merchant application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-resident.no-contacts.json"),
    sample(contour, "UL resident missing contacts", noContacts, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "UL.CONTACTS.MIN_ONE", field: null, level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-resident.foreign-legal-address.json"),
    sample(contour, "UL resident foreign legal address reject", foreignLegalAddress, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "UL.ADDRESS.LEGAL.COUNTRY_RU", field: "beneficiary.address.legal.countryCode", level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-resident.foreign-tax-resident.json"),
    sample(contour, "UL resident foreign tax resident reject", foreignTaxResident, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "UL.TAX.FOREIGN_TAX_RESIDENT.NOT_TRUE", field: "beneficiary.tax.foreignTaxResident", level: "EXCEPTION" }],
    }),
  );
}

function ulNonresidentApplication(overrides = {}) {
  const beneficiaryOverrides = overrides.beneficiary || {};
  const application = {
    requestExtId: "ul-nonresident-test-request-0001",
    beneficiary: {
      type: "UL_NONRESIDENT",
      inn: "9909668680",
      participationId: "UL-NRES-PARTICIPATION-0001",
      account: { number: "40702810120028000006" },
      contacts: {
        email: "beneficiary@example.kz",
        foreignPhone: "+7 7182 44-28-91",
      },
      status: { startDate: "2026-06-15" },
      ul: {
        kpp: "990901001",
        kio: "99096",
        fullName: "АКЦИОНЕРНОЕ ОБЩЕСТВО \"KAZAKHSTAN TEST COMPANY\"",
        shortName: "АО \"KAZAKHSTAN TEST COMPANY\"",
        foreignFullName: "KAZAKHSTAN TEST COMPANY JSC",
        foreignShortName: "KTC JSC",
        countryCode: "KZ",
        registration: {
          number: "231240027226",
          date: "2023-12-27",
          agency: "Управление регистрации юридических лиц филиала НАО \"Государственная корпорация\"",
          place: "Республика Казахстан",
        },
      },
      address: {
        legal: {
          countryCode: "KZ",
          fullAddress: "Казахстан, город Астана, район Есиль, Проспект Кабанбай Батыр, дом 38/2, кв. 264, почтовый индекс 010000",
        },
      },
      tax: {
        foreignTaxResident: true,
        passiveNfe: false,
        controllingPersonsForeignTaxResident: false,
        foreignTaxResidency: {
          countryCode: "KZ",
          tin: "9909668680",
        },
        usTaxResident: false,
        controllingPersonsUsTaxResident: false,
      },
    },
  };

  application.beneficiary = {
    ...application.beneficiary,
    ...beneficiaryOverrides,
  };
  return application;
}

function writeUlNonresidentSamples(contour) {
  const ok = ulNonresidentApplication();
  const noContacts = ulNonresidentApplication({
    beneficiary: {
      contacts: {
        email: "",
        foreignPhone: "",
      },
    },
  });
  const invalidInnMask = ulNonresidentApplication({
    beneficiary: { inn: "7712345678" },
  });
  const missingForeignResidency = ulNonresidentApplication({
    beneficiary: {
      tax: {
        foreignTaxResident: false,
        passiveNfe: false,
        controllingPersonsForeignTaxResident: false,
        foreignTaxResidency: {
          countryCode: "",
          tin: "",
        },
        usTaxResident: false,
        controllingPersonsUsTaxResident: false,
      },
    },
  });
  const passiveNfe = ulNonresidentApplication({
    beneficiary: {
      tax: {
        foreignTaxResident: true,
        passiveNfe: true,
        controllingPersonsForeignTaxResident: false,
        foreignTaxResidency: {
          countryCode: "KZ",
          tin: "9909668680",
        },
        usTaxResident: false,
        controllingPersonsUsTaxResident: false,
      },
    },
  });
  const ruCountry = ulNonresidentApplication({
    beneficiary: {
      ul: {
        ...ok.beneficiary.ul,
        countryCode: "RU",
      },
      address: {
        legal: {
          countryCode: "RU",
          fullAddress: "Российская Федерация, Москва",
        },
      },
    },
  });

  writeJson(
    path.join(rootDir, "samples/ul-nonresident.ok.json"),
    sample(contour, "UL nonresident valid merchant application", ok, { status: "OK", exact: true, issues: [] }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-nonresident.no-contacts.json"),
    sample(contour, "UL nonresident missing contacts", noContacts, {
      status: "ERROR",
      exact: true,
      issues: [{ code: "UL_NONRESIDENT.UL.CONTACTS.MIN_ONE", field: null, level: "ERROR" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-nonresident.invalid-inn-mask.json"),
    sample(contour, "UL nonresident INN mask reject", invalidInnMask, {
      status: "ERROR",
      exact: true,
      issues: [
        { code: "UL.INN.NONRESIDENT_MASK", field: "beneficiary.inn", level: "ERROR" },
        { code: "UL_NONRESIDENT.UL.INN.INVALID", field: "beneficiary.inn", level: "ERROR" },
      ],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-nonresident.missing-foreign-tax-residency.json"),
    sample(contour, "UL nonresident missing foreign tax residency", missingForeignResidency, {
      status: "ERROR",
      exact: true,
      issues: [
        { code: "UL.TAX.FOREIGN_TAX_RESIDENT.MUST_BE_TRUE", field: "beneficiary.tax.foreignTaxResident", level: "ERROR" },
        { code: "UL.TAX.FOREIGN_RESIDENCY.COUNTRY.REQUIRED", field: "beneficiary.tax.foreignTaxResidency.countryCode", level: "ERROR" },
        { code: "UL.TAX.FOREIGN_RESIDENCY.TIN.REQUIRED", field: "beneficiary.tax.foreignTaxResidency.tin", level: "ERROR" },
      ],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-nonresident.passive-nfe.json"),
    sample(contour, "UL nonresident passive NFE reject", passiveNfe, {
      status: "EXCEPTION",
      exact: true,
      issues: [{ code: "UL_NONRESIDENT.UL.TAX.PASSIVE_NFE.NOT_TRUE", field: "beneficiary.tax.passiveNfe", level: "EXCEPTION" }],
    }),
  );
  writeJson(
    path.join(rootDir, "samples/ul-nonresident.ru-country.json"),
    sample(contour, "UL nonresident Russian country reject", ruCountry, {
      status: "ERROR",
      exact: true,
      issues: [
        { code: "UL.COUNTRY.FORMAT_NON_RU", field: "beneficiary.ul.countryCode", level: "ERROR" },
        { code: "UL.ADDRESS.LEGAL.COUNTRY_FORMAT_NON_RU", field: "beneficiary.address.legal.countryCode", level: "ERROR" },
      ],
    }),
  );
}

function unbindApplication(overrides = {}) {
  const beneficiaryOverrides = overrides.beneficiary || {};
  const application = {
    beneficiary: {
      type: "UL_NONRESIDENT",
      participationId: "UNBIND-PARTICIPATION-0001",
      inn: "9909890614",
      account: { number: "40702810120028000006" },
      status: {
        startDate: "2026-05-18",
        endDate: "2026-06-03",
      },
    },
  };

  application.beneficiary = {
    ...application.beneficiary,
    ...beneficiaryOverrides,
  };
  return application;
}

function writeUnbindSamples(contour) {
  const [typeSupportedPipelineId, fieldValidationPipelineId] = contour.entrypointIds;
  const ok = unbindApplication();
  const unsupportedType = unbindApplication({
    beneficiary: {
      type: "UNSUPPORTED_TYPE",
      inn: "7707083893",
    },
  });
  const invalidInn = unbindApplication({
    beneficiary: { inn: "1234567890" },
  });
  const invalidEndDate = unbindApplication({
    beneficiary: {
      status: {
        ...ok.beneficiary.status,
        endDate: "2026/06/03",
      },
    },
  });

  writeJson(
    path.join(rootDir, "samples/beneficiary-unbind.type-ok.json"),
    sampleWithPipeline(
      contour,
      typeSupportedPipelineId,
      "Beneficiary unbind supported type",
      ok,
      { status: "OK", exact: true, issues: [] },
    ),
  );
  writeJson(
    path.join(rootDir, "samples/beneficiary-unbind.unsupported-type.json"),
    sampleWithPipeline(
      contour,
      typeSupportedPipelineId,
      "Beneficiary unbind unsupported type",
      unsupportedType,
      {
        status: "ERROR",
        exact: true,
        issues: [{ code: "BENEFICIARY_UNBIND_TYPE_SUPPORTED", field: "beneficiary.type", level: "ERROR" }],
      },
    ),
  );
  writeJson(
    path.join(rootDir, "samples/beneficiary-unbind.fields-ok.json"),
    sampleWithPipeline(
      contour,
      fieldValidationPipelineId,
      "Beneficiary unbind valid fields",
      ok,
      { status: "OK", exact: true, issues: [] },
    ),
  );
  writeJson(
    path.join(rootDir, "samples/beneficiary-unbind.invalid-inn.json"),
    sampleWithPipeline(
      contour,
      fieldValidationPipelineId,
      "Beneficiary unbind invalid INN",
      invalidInn,
      {
        status: "ERROR",
        exact: true,
        issues: [{ code: "BENEFICIARY_UNBIND_INN_VALID", field: "beneficiary.inn", level: "ERROR" }],
      },
    ),
  );
  writeJson(
    path.join(rootDir, "samples/beneficiary-unbind.invalid-end-date.json"),
    sampleWithPipeline(
      contour,
      fieldValidationPipelineId,
      "Beneficiary unbind invalid end date",
      invalidEndDate,
      {
        status: "ERROR",
        exact: true,
        issues: [{ code: "BENEFICIARY_UNBIND_END_DATE_FORMAT", field: "beneficiary.status.endDate", level: "ERROR" }],
      },
    ),
  );
}

function writeSamples() {
  writeResidentSamples(contours[0]);
  writeNonresidentSamples(contours[1]);
  writeIpResidentSamples(contours[2]);
  writeIpNonresidentSamples(contours[3]);
  writeUlResidentSamples(contours[4]);
  writeUlNonresidentSamples(contours[5]);
  writeUnbindSamples(contours[6]);
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
    fieldContractPath: repoRelative(contour.fieldContractPath),
    sourceArtifacts: contour.artifacts.length,
    entrypointId: contour.entrypointId,
    entrypointIds: contour.entrypointIds || [contour.entrypointId],
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
