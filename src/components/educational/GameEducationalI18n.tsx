"use client";

import { EducationalValueSection } from "@/components/educational/EducationalValueSection";
import { useI18n } from "@/lib/i18n-context";

export function PairLinkEducationalI18n() {
  const { t } = useI18n();
  const p = "educational.pairLink";
  return (
    <EducationalValueSection summaryLabel={t(`${p}.summary`)}>
      <h3>{t(`${p}.h3_dev`)}</h3>
      <p>{t(`${p}.p_dev`)}</p>
      <h3>{t(`${p}.h3_neuro`)}</h3>
      <p>{t(`${p}.p_neuro`)}</p>
      <h3>{t(`${p}.h3_mont`)}</h3>
      <p>{t(`${p}.p_mont`)}</p>
      <h3>{t(`${p}.h3_step`)}</h3>
      <p>{t(`${p}.p_step`)}</p>
    </EducationalValueSection>
  );
}

export function SkyscraperEducationalI18n() {
  const { t } = useI18n();
  const p = "educational.skyscraper";
  return (
    <EducationalValueSection summaryLabel={t(`${p}.summary`)}>
      <h3>{t(`${p}.h3_dev`)}</h3>
      <p>{t(`${p}.p_dev`)}</p>
      <h3>{t(`${p}.h3_neuro`)}</h3>
      <p>{t(`${p}.p_neuro`)}</p>
      <h3>{t(`${p}.h3_mont`)}</h3>
      <p>{t(`${p}.p_mont`)}</p>
      <h3>{t(`${p}.h3_step`)}</h3>
      <p>{t(`${p}.p_step`)}</p>
    </EducationalValueSection>
  );
}

export function ReflecLabEducationalI18n() {
  const { t } = useI18n();
  const p = "educational.reflecLab";
  return (
    <EducationalValueSection summaryLabel={t(`${p}.summary`)}>
      <h3>{t(`${p}.h3_dev`)}</h3>
      <p>{t(`${p}.p_dev`)}</p>
      <h3>{t(`${p}.h3_neuro`)}</h3>
      <p>{t(`${p}.p_neuro`)}</p>
      <h3>{t(`${p}.h3_mont`)}</h3>
      <p>{t(`${p}.p_mont`)}</p>
      <h3>{t(`${p}.h3_step`)}</h3>
      <p>{t(`${p}.p_step`)}</p>
    </EducationalValueSection>
  );
}

export function PresSureEducationalI18n() {
  const { t } = useI18n();
  const p = "educational.presSure";
  return (
    <EducationalValueSection summaryLabel={t(`${p}.summary`)}>
      <h3>{t(`${p}.h3_dev`)}</h3>
      <p>{t(`${p}.p_dev`)}</p>
      <h3>{t(`${p}.h3_neuro`)}</h3>
      <p>{t(`${p}.p_neuro`)}</p>
      <h3>{t(`${p}.h3_mont`)}</h3>
      <p>{t(`${p}.p_mont`)}</p>
      <h3>{t(`${p}.h3_step`)}</h3>
      <p>{t(`${p}.p_step`)}</p>
    </EducationalValueSection>
  );
}
