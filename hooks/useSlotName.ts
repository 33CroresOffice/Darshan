import { useTranslation } from "react-i18next";
import type { DarshanSlot } from "@/types/database";

export function useSlotName() {
  const { i18n } = useTranslation();
  return (slot: DarshanSlot) =>
    i18n.language === "or" && slot.odia_name ? slot.odia_name : slot.name;
}
