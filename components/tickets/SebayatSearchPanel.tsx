import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Search, Phone, IdCard, ChevronRight, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { searchSebayatResilient } from "@/services/offlineEntryService";
import { connectivity, loadSebayatListCache } from "@/lib/offline";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration } from "@/types/database";

type SearchMode = "phone" | "templeid";

interface SebayatSearchPanelProps {
  onSelect: (sebayat: SebayatRegistration) => void;
}

export function SebayatSearchPanel({ onSelect }: SebayatSearchPanelProps) {
  const { t } = useTranslation();
  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SebayatRegistration[] | null>(null);
  const [singleResult, setSingleResult] = useState<SebayatRegistration | null | "notfound">(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());
  const [cacheSize, setCacheSize] = useState<number | null>(null);

  useEffect(() => {
    const unsub = connectivity.subscribe(() => setIsOffline(!connectivity.isOnline()));
    loadSebayatListCache().then((list) => setCacheSize(list.length));
    return unsub;
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    setSingleResult(null);

    try {
      const found = await searchSebayatResilient(query.trim(), searchMode);
      setSingleResult(found ?? "notfound");
    } catch {
      setError(t("supervisor.sebayatTickets.searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const modes: { key: SearchMode; label: string; icon: typeof Phone; placeholder: string }[] = [
    {
      key: "phone",
      label: t("supervisor.sebayatTickets.tabPhone"),
      icon: Phone,
      placeholder: t("supervisor.sebayatTickets.placeholderPhone"),
    },
    {
      key: "templeid",
      label: t("supervisor.sebayatTickets.tabTempleId"),
      icon: IdCard,
      placeholder: t("supervisor.sebayatTickets.placeholderTempleId"),
    },
  ];

  const currentMode = modes.find((m) => m.key === searchMode)!;

  const singleSebayat = singleResult !== "notfound" ? singleResult : null;
  const notFound = singleResult === "notfound";

  const allResults: SebayatRegistration[] = results
    ? results
    : singleSebayat
    ? [singleSebayat]
    : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      {isOffline && cacheSize === 0 && (
        <View style={styles.emptyCacheBanner}>
          <WifiOff size={16} color="#92400E" />
          <Text style={styles.emptyCacheBannerText}>{t("supervisor.sebayatTickets.offlineNoCacheWarning")}</Text>
        </View>
      )}
      {isOffline && cacheSize !== null && cacheSize > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {t("common.offlineSearchNote")} {t("supervisor.sebayatTickets.offlineCacheCount", { count: cacheSize })}
          </Text>
        </View>
      )}
      {isOffline && cacheSize === null && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>{t("common.offlineSearchNote")}</Text>
        </View>
      )}
      <View style={styles.modeTabs}>
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = searchMode === mode.key;
          return (
            <TouchableOpacity
              key={mode.key}
              style={[styles.modeTab, active && styles.modeTabActive]}
              onPress={() => {
                setSearchMode(mode.key);
                setQuery("");
                setResults(null);
                setSingleResult(null);
                setError(null);
              }}
            >
              <Icon size={14} color={active ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrapper}>
          <Search size={16} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={currentMode.placeholder}
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            keyboardType={searchMode === "phone" ? "phone-pad" : "default"}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.searchButton, (!query.trim() || searching) && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!query.trim() || searching}
        >
          {searching ? (
            <ActivityIndicator size="small" color={COLORS.surface} />
          ) : (
            <Text style={styles.searchButtonText}>{t("supervisor.sebayatTickets.searchBtn")}</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {notFound && !searching && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t("supervisor.sebayatTickets.notFound")}</Text>
          <Text style={styles.emptySubtext}>
            {isOffline && cacheSize === 0
              ? t("supervisor.sebayatTickets.notFoundOfflineNoCache")
              : isOffline
              ? t("supervisor.sebayatTickets.notFoundOffline")
              : searchMode === "phone"
              ? t("supervisor.sebayatTickets.notFoundPhone")
              : t("supervisor.sebayatTickets.notFoundTempleId")}
          </Text>
        </View>
      )}

      {results !== null && results.length === 0 && !searching && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t("supervisor.sebayatTickets.notFound")}</Text>
          <Text style={styles.emptySubtext}>{t("supervisor.sebayatTickets.searchFailed")}</Text>
        </View>
      )}

      {allResults.length > 0 && (
        <ScrollView
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allResults.map((sebayat) => (
            <SebayatCard key={sebayat.id} sebayat={sebayat} onPress={() => onSelect(sebayat)} />
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function SebayatCard({
  sebayat,
  onPress,
}: {
  sebayat: SebayatRegistration;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sebayatCard} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: sebayat.photo_url }}
        style={styles.sebayatPhoto}
      />
      <View style={styles.sebayatInfo}>
        <Text style={styles.sebayatName}>{sebayat.full_name}</Text>
        {sebayat.category?.name && (
          <Text style={styles.sebayatCategory}>{sebayat.category.name}</Text>
        )}
        {sebayat.temple_health_card_id && (
          <Text style={styles.sebayatId}>HC: {sebayat.temple_health_card_id}</Text>
        )}
        {sebayat.phone_number && (
          <Text style={styles.sebayatPhone}>{sebayat.phone_number}</Text>
        )}
      </View>
      <ChevronRight size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  offlineBannerText: {
    fontSize: 12,
    color: "#92400E",
    textAlign: "center",
  },
  emptyCacheBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyCacheBannerText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  modeTabActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    gap: 6,
  },
  inputIcon: {
    marginLeft: 2,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: COLORS.text,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
    height: 44,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.surface,
  },
  errorRow: {
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  resultsList: {
    flex: 1,
  },
  sebayatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    ...SHADOWS.small,
  },
  sebayatPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.border,
  },
  sebayatInfo: {
    flex: 1,
  },
  sebayatName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  sebayatCategory: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
    marginTop: 1,
  },
  sebayatId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  sebayatPhone: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
