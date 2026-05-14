import { useTranslation } from "react-i18next";
import { localizeNumber } from "@/lib/i18n";

export function useLocalizedNumber() {
  const { i18n } = useTranslation();
  return (n: number | string) => localizeNumber(n, i18n.language);
}
