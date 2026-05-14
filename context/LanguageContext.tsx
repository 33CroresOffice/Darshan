import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { loadSavedLanguage, changeLanguage, type SupportedLanguage } from "@/lib/i18n";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    loadSavedLanguage().then(() => {
      import("@/lib/i18n").then(({ default: i18n }) => {
        const lang = i18n.language as SupportedLanguage;
        setLanguageState(lang || "en");
      });
    });
  }, []);

  const setLanguage = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
