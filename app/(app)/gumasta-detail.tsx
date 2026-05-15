import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  User,
  Phone,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Calendar,
  Users,
  Camera,
} from "lucide-react-native";
import * as ExpoImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import {
  getGumastaById,
  updateGumasta,
  toggleGumastaActive,
  deleteGumasta,
  getTicketsByGumasta,
  uploadGumastaPhoto,
} from "@/services/gumastaService";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/actions/Button";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Gumasta, GateEntry } from "@/types/database";

export default function GumastaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { registration } = useAuth();
  const [gumasta, setGumasta] = useState<Gumasta | null>(null);
  const [tickets, setTickets] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [error, setError] = useState("");

  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [g, tix] = await Promise.all([
        getGumastaById(id),
        getTicketsByGumasta(id),
      ]);
      setGumasta(g);
      setTickets(tix);
      if (g) {
        setEditName(g.name);
        setEditContact(g.contact_number);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleActive = async () => {
    if (!gumasta) return;
    try {
      await toggleGumastaActive(gumasta.id, !gumasta.is_active);
      setGumasta({ ...gumasta, is_active: !gumasta.is_active });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!gumasta) return;
    try {
      await deleteGumasta(gumasta.id);
      setDeleteModalVisible(false);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const pickImage = async () => {
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
    }
  };

  const handleSaveEdit = async () => {
    if (!gumasta || !registration?.id) return;
    if (!editName.trim() || !editContact.trim()) return;
    setSaving(true);
    setError("");
    try {
      let photoUrl = gumasta.photo_url;
      if (editPhotoUri) {
        photoUrl = await uploadGumastaPhoto(registration.id, gumasta.id, editPhotoUri);
      }
      const updated = await updateGumasta(gumasta.id, {
        name: editName.trim(),
        contact_number: editContact.trim(),
        photo_url: photoUrl,
      });
      setGumasta(updated);
      setEditing(false);
      setEditPhotoUri(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !gumasta) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("gumasta.editGumasta")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? t("gumasta.editGumasta") : gumasta.name}
        </Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.backBtn}>
            <Pencil size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {editing ? (
            <>
              <TouchableOpacity style={styles.editPhoto} onPress={pickImage}>
                {editPhotoUri || gumasta.photo_url ? (
                  <Image
                    source={{ uri: editPhotoUri || gumasta.photo_url! }}
                    style={styles.avatarLarge}
                  />
                ) : (
                  <View style={styles.avatarPlaceholderLarge}>
                    <Camera size={28} color={COLORS.textMuted} />
                  </View>
                )}
                <Text style={styles.changePhotoText}>{t("gumasta.changePhoto")}</Text>
              </TouchableOpacity>

              <Input
                label={t("gumasta.name")}
                value={editName}
                onChangeText={setEditName}
              />
              <Input
                label={t("gumasta.contactNumber")}
                value={editContact}
                onChangeText={setEditContact}
                keyboardType="phone-pad"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.editActions}>
                <Button
                  title={t("common.cancel")}
                  onPress={() => {
                    setEditing(false);
                    setEditName(gumasta.name);
                    setEditContact(gumasta.contact_number);
                    setEditPhotoUri(null);
                  }}
                  variant="outline"
                  style={{ flex: 1, marginRight: SPACING.sm }}
                />
                <Button
                  title={t("common.save")}
                  onPress={handleSaveEdit}
                  loading={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.profileSection}>
                {gumasta.photo_url ? (
                  <Image source={{ uri: gumasta.photo_url }} style={styles.avatarLarge} />
                ) : (
                  <View style={styles.avatarPlaceholderLarge}>
                    <User size={36} color={COLORS.textMuted} />
                  </View>
                )}
                <Text style={styles.profileName}>{gumasta.name}</Text>
                <View style={styles.phoneRow}>
                  <Phone size={14} color={COLORS.textSecondary} />
                  <Text style={styles.profilePhone}>{gumasta.contact_number}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: gumasta.is_active
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(107, 114, 128, 0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: gumasta.is_active ? COLORS.success : COLORS.textMuted },
                    ]}
                  >
                    {gumasta.is_active ? t("gumasta.active") : t("gumasta.inactive")}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleToggleActive}>
                  {gumasta.is_active ? (
                    <ToggleRight size={20} color={COLORS.success} />
                  ) : (
                    <ToggleLeft size={20} color={COLORS.textMuted} />
                  )}
                  <Text style={styles.actionText}>
                    {gumasta.is_active ? t("gumasta.disable") : t("gumasta.enable")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: COLORS.error }]}
                  onPress={() => setDeleteModalVisible(true)}
                >
                  <Trash2 size={18} color={COLORS.error} />
                  <Text style={[styles.actionText, { color: COLORS.error }]}>
                    {t("gumasta.deleteGumasta")}
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>{t("gumasta.workHistory")}</Text>
                {tickets.length === 0 ? (
                  <Text style={styles.emptyHistory}>{t("gumasta.noHistory")}</Text>
                ) : (
                  tickets.map((ticket) => (
                    <View key={ticket.id} style={styles.historyCard}>
                      <View style={styles.historyRow}>
                        <Calendar size={14} color={COLORS.textSecondary} />
                        <Text style={styles.historyDate}>{ticket.entry_date}</Text>
                        <View
                          style={[
                            styles.ticketStatusDot,
                            {
                              backgroundColor:
                                ticket.status === "verified"
                                  ? COLORS.success
                                  : ticket.status === "pending"
                                  ? COLORS.accent
                                  : COLORS.textMuted,
                            },
                          ]}
                        />
                        <Text style={styles.historyStatus}>{ticket.status}</Text>
                      </View>
                      <View style={styles.historyRow}>
                        <Users size={14} color={COLORS.textSecondary} />
                        <Text style={styles.historyCount}>
                          {ticket.declared_devotee_count} devotees
                        </Text>
                        <Text style={styles.historyCode}>{ticket.entry_code}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("gumasta.deleteGumasta")}</Text>
            <Text style={styles.modalText}>{t("gumasta.deleteConfirm")}</Text>
            <View style={styles.modalActions}>
              <Button
                title={t("common.cancel")}
                onPress={() => setDeleteModalVisible(false)}
                variant="outline"
                style={{ flex: 1, marginRight: SPACING.sm }}
              />
              <Button
                title={t("gumasta.deleteGumasta")}
                onPress={handleDelete}
                style={{ flex: 1, backgroundColor: COLORS.error }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarPlaceholderLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginVertical: SPACING.sm,
    textAlign: "center",
  },
  historySection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyHistory: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    paddingVertical: SPACING.lg,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  historyStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: "capitalize",
  },
  historyCount: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  historyCode: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  ticketStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editPhoto: {
    alignSelf: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  changePhotoText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 6,
  },
  editActions: {
    flexDirection: "row",
    marginTop: SPACING.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: "row",
  },
});
