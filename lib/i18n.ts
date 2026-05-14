import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "@/locales/en.json";
import or from "@/locales/or.json";

export const LANGUAGE_STORAGE_KEY = "@app_language";
export const SUPPORTED_LANGUAGES = ["en", "or"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const ODIA_DIGITS = ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"];

export function toOdiaDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ODIA_DIGITS[parseInt(d)]);
}

export function localizeNumber(n: number | string, lang: string): string {
  return lang === "or" ? toOdiaDigits(n) : String(n);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    or: { translation: or },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
    format(value, format, lng) {
      if (typeof value === "number" && lng === "or") {
        return toOdiaDigits(value);
      }
      return value;
    },
  },
  compatibilityJSON: "v4",
});

export async function loadSavedLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // keep default
  }
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export default i18n;
