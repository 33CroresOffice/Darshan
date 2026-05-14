import { useState } from "react";
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
import { Search, Phone, IdCard, ChevronRight } from "lucide-react-native";
import { searchSebayatByPhone, searchSebayatByTempleId } from "@/services/entryService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { SebayatRegistration } from "@/types/database";

type SearchMode = "phone" | "templeid";

interface SebayatSearchPanelProps {
  onSelect: (sebayat: SebayatRegistration) => void;
}

export function SebayatSearchPanel({ onSelect }: SebayatSearchPanelProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SebayatRegistration[] | null>(null);
  const [singleResult, setSingleResult] = useState<SebayatRegistration | null | "notfound">(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    setSingleResult(null);

    try {
      if (searchMode === "phone") {
        const found = await searchSebayatByPhone(query.trim());
        setSingleResult(found ?? "notfound");
      } else {
        const found = await searchSebayatByTempleId(query.trim());
        setSingleResult(found ?? "notfound");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const modes: { key: SearchMode; label: string; icon: typeof Phone; placeholder: string }[] = [
    { key: "phone", label: "Phone", icon: Phone, placeholder: "10-digit mobile number" },
    { key: "templeid", label: "Temple ID", icon: IdCard, placeholder: "Temple ID card number" },
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
            <Text style={styles.searchButtonText}>Search</Text>
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
          <Text style={styles.emptyTitle}>No sebayat found</Text>
          <Text style={styles.emptySubtext}>
            No approved sebayat matches this{" "}
            {searchMode === "phone" ? "phone number" : "temple ID"}.
          </Text>
        </View>
      )}

      {results !== null && results.length === 0 && !searching && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptySubtext}>Try a different name.</Text>
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
