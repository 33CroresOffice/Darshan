import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  Phone,
  User,
  Check,
  CircleAlert as AlertCircle,
  Eye,
  Search,
  UserPlus,
  Users,
} from "lucide-react-native";
import {
  createAdminUser,
  getApprovedSebayatsForPromotion,
  promoteUserRole,
  type ApprovedSebayatForPromotion,
} from "@/services/userService";
import { useAuth } from "@/context/AuthContext";
import { COLORS, SHADOWS } from "@/constants/config";

type TabMode = "search" | "create";

export default function CreateAdminScreen() {
  const router = useRouter();
  const { profile: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "superadmin";
  const [activeTab, setActiveTab] = useState<TabMode>("search");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin" | "supervisor">("supervisor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApprovedSebayatForPromotion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<ApprovedSebayatForPromotion | null>(null);

  useEffect(() => {
    if (activeTab === "search") {
      loadApprovedSebayats(0, true);
    }
  }, [activeTab]);

  const loadApprovedSebayats = async (pageNum: number = 0, reset: boolean = false) => {
    if (reset) setSearching(true);
    else setLoadingMore(true);
    try {
      const { results, hasMore: more } = await getApprovedSebayatsForPromotion(searchQuery, pageNum);
      if (reset) {
        setSearchResults(results);
      } else {
        setSearchResults((prev) => [...prev, ...results]);
      }
      setHasMore(more);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to load sebayats:", err);
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = async () => {
    await loadApprovedSebayats(0, true);
  };

  const handleLoadMore = async () => {
    await loadApprovedSebayats(page + 1, false);
  };

  const handlePromoteUser = async () => {
    if (!selectedUser) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await promoteUserRole(selectedUser.user_id, role);

      if (result.success) {
        setSuccess(result.message);
        setSelectedUser(null);
        loadApprovedSebayats();
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to promote user");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    setError(null);
    setSuccess(null);

    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = `+91${phone}`;
      const result = await createAdminUser(formattedPhone, fullName.trim(), role);

      if (result.success) {
        setSuccess(result.message);
        setPhone("");
        setFullName("");
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColors = (roleValue: "admin" | "superadmin" | "supervisor") => {
    switch (roleValue) {
      case "superadmin":
        return { bg: "#E0F2FE", accent: "#0EA5E9" };
      case "admin":
        return { bg: "#D1FAE5", accent: "#10B981" };
      case "supervisor":
        return { bg: "#FEF3C7", accent: "#F59E0B" };
    }
  };

  const getRoleLabel = (roleValue: string) => {
    switch (roleValue) {
      case "superadmin":
        return "Super Admin";
      case "admin":
        return "Admin";
      case "supervisor":
        return "Supervisor";
      default:
        return "Darshan";
    }
  };

  const RoleOption = ({
    value,
    label,
    description,
    icon,
  }: {
    value: "admin" | "superadmin" | "supervisor";
    label: string;
    description: string;
    icon: React.ReactNode;
  }) => {
    const isSelected = role === value;
    const colors = getRoleColors(value);

    return (
      <TouchableOpacity
        style={[
          styles.roleOption,
          isSelected && { borderColor: colors.accent, backgroundColor: colors.bg + "40" },
        ]}
        onPress={() => setRole(value)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.roleIconContainer,
            { backgroundColor: isSelected ? colors.accent : COLORS.surfaceSecondary },
          ]}
        >
          {icon}
        </View>
        <View style={styles.roleInfo}>
          <Text style={[styles.roleLabel, isSelected && { color: colors.accent }]}>
            {label}
          </Text>
          <Text style={styles.roleDescription}>{description}</Text>
        </View>
        <View
          style={[
            styles.radioOuter,
            isSelected && { borderColor: colors.accent, backgroundColor: colors.accent },
          ]}
        >
          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  const SebayatCard = ({ item }: { item: ApprovedSebayatForPromotion }) => {
    const isSelected = selectedUser?.user_id === item.user_id;
    const roleColors = getRoleColors(
      item.current_role === "sebayat" ? "supervisor" : (item.current_role as any)
    );

    return (
      <TouchableOpacity
        style={[styles.sebayatCard, isSelected && styles.sebayatCardSelected]}
        onPress={() => setSelectedUser(isSelected ? null : item)}
        activeOpacity={0.7}
      >
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.sebayatAvatar} />
        ) : (
          <View style={[styles.sebayatAvatar, styles.sebayatAvatarPlaceholder]}>
            <Text style={styles.sebayatAvatarText}>
              {item.full_name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
        <View style={styles.sebayatInfo}>
          <Text style={styles.sebayatName}>{item.full_name}</Text>
          <Text style={styles.sebayatPhone}>{item.phone_number}</Text>
          {item.category_name && (
            <Text style={styles.sebayatCategory}>{item.category_name}</Text>
          )}
        </View>
        <View style={styles.sebayatRight}>
          <View style={[styles.currentRoleBadge, { backgroundColor: roleColors.bg }]}>
            <Text style={[styles.currentRoleText, { color: roleColors.accent }]}>
              {getRoleLabel(item.current_role)}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Check size={16} color={COLORS.primary} strokeWidth={3} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.headerIcon}>
              <ShieldCheck size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Assign Role</Text>
            <Text style={styles.subtitle}>
              Promote approved Darshans or create new staff accounts
            </Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "search" && styles.tabActive]}
              onPress={() => setActiveTab("search")}
            >
              <Users size={18} color={activeTab === "search" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, activeTab === "search" && styles.tabTextActive]}>
                Promote Darshan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "create" && styles.tabActive]}
              onPress={() => setActiveTab("create")}
            >
              <UserPlus size={18} color={activeTab === "create" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.tabText, activeTab === "create" && styles.tabTextActive]}>
                New User
              </Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <AlertCircle size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successCard}>
              <Check size={20} color={COLORS.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {activeTab === "search" && (
            <>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                  <Search size={20} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name or phone..."
                    placeholderTextColor={COLORS.textMuted}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                </View>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  activeOpacity={0.7}
                >
                  <Search size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {searching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading darshans...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>No approved Darshans found</Text>
                  <Text style={styles.emptySubtext}>
                    Search for an approved Darshan to promote
                  </Text>
                </View>
              ) : (
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsTitle}>
                    {searchResults.length} Approved Darshan{searchResults.length !== 1 ? "s" : ""}
                    {hasMore ? "+" : ""}
                  </Text>
                  {searchResults.map((item) => (
                    <SebayatCard key={item.user_id} item={item} />
                  ))}
                  {hasMore && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={handleLoadMore}
                      disabled={loadingMore}
                      activeOpacity={0.7}
                    >
                      {loadingMore ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Text style={styles.loadMoreText}>Load More</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {selectedUser && (
                <View style={styles.promotionSection}>
                  <Text style={styles.promotionTitle}>
                    Promote {selectedUser.full_name}
                  </Text>
                  <View style={styles.roleSection}>
                    <Text style={styles.roleSectionTitle}>Select New Role</Text>
                    <View style={styles.roleOptions}>
                      <RoleOption
                        value="supervisor"
                        label="Supervisor"
                        description="Can oversee and monitor activities"
                        icon={<Eye size={24} color={role === "supervisor" ? "#fff" : COLORS.textSecondary} />}
                      />
                      <RoleOption
                        value="admin"
                        label="Admin"
                        description="Can review and approve registrations"
                        icon={<Shield size={24} color={role === "admin" ? "#fff" : COLORS.textSecondary} />}
                      />
                      {isSuperAdmin && (
                        <RoleOption
                          value="superadmin"
                          label="Super Admin"
                          description="Full access including user management"
                          icon={<ShieldCheck size={24} color={role === "superadmin" ? "#fff" : COLORS.textSecondary} />}
                        />
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handlePromoteUser}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitButtonText}>
                      {loading ? "Promoting..." : `Promote to ${getRoleLabel(role)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {activeTab === "create" && (
            <>
              <View style={styles.infoCard}>
                <AlertCircle size={20} color={COLORS.warning} />
                <Text style={styles.infoText}>
                  New users should first be registered as sebayats before being promoted. Use this only for special cases.
                </Text>
              </View>

              <View style={styles.formCard}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIcon}>
                      <Phone size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.inputPrefix}>+91</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIcon}>
                      <User size={20} color={COLORS.primary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter full name"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.roleSection}>
                  <Text style={styles.roleSectionTitle}>Select Role</Text>
                  <View style={styles.roleOptions}>
                    <RoleOption
                      value="supervisor"
                      label="Supervisor"
                      description="Can oversee and monitor activities"
                      icon={<Eye size={24} color={role === "supervisor" ? "#fff" : COLORS.textSecondary} />}
                    />
                    <RoleOption
                      value="admin"
                      label="Admin"
                      description="Can review and approve registrations"
                      icon={<Shield size={24} color={role === "admin" ? "#fff" : COLORS.textSecondary} />}
                    />
                    {isSuperAdmin && (
                      <RoleOption
                        value="superadmin"
                        label="Super Admin"
                        description="Full access including user management"
                        icon={<ShieldCheck size={24} color={role === "superadmin" ? "#fff" : COLORS.textSecondary} />}
                      />
                    )}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleCreateNew}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? "Creating..." : "Create User"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  tabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "500",
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#D1FAE5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successText: {
    flex: 1,
    color: COLORS.success,
    fontSize: 14,
    fontWeight: "500",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  infoText: {
    flex: 1,
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  sebayatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 12,
  },
  sebayatCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + "30",
  },
  sebayatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.border,
  },
  sebayatAvatarPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sebayatAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  sebayatInfo: {
    flex: 1,
  },
  sebayatName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  sebayatPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sebayatCategory: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sebayatRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  currentRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentRoleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  selectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  promotionSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  promotionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "500",
  },
  roleSection: {
    marginTop: 8,
  },
  roleSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  roleOptions: {
    gap: 12,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 14,
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  roleInfo: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 3,
  },
  roleDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.small,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
