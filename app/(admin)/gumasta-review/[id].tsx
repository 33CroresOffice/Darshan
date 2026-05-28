import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  X,
  User,
  Phone,
  IdCard,
  ShieldCheck,
  Clock,
  CircleCheck as CheckCircle,
  Circle as XCircle,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { getGumastaById, getGumastaVoteSummary, voteOnGumasta, superadminApproveGumasta } from "@/services/gumastaService";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type { Gumasta, GumastaVoteSummary } from "@/types/database";

export default function GumastaReviewDetailScreen() {
  const tabBarHeight = 0;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "superadmin";

  const [gumasta, setGumasta] = useState<Gumasta | null>(null);
  const [voteSummary, setVoteSummary] = useState<GumastaVoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReasonError, setRejectionReasonError] = useState("");

  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [g, summary] = await Promise.all([
        getGumastaById(id),
        getGumastaVoteSummary(id),
      ]);
      setGumasta(g);
      setVoteSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const myVote = profile?.id
    ? voteSummary?.approvals.find((a) => a.admin_id === profile.id)
    : undefined;

  const hasAlreadyVoted = !!myVote;

  const handleApprove = async () => {
    if (!id || !profile?.id) return;
    setProcessing(true);
    setError("");
    try {
      await voteOnGumasta(id, profile.id, "approved");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenReject = () => {
    setRejectionReason("");
    setRejectionReasonError("");
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectionReasonError("Please provide a reason for rejection");
      return;
    }
    if (!id || !profile?.id) return;
    setProcessing(true);
    setRejectModalVisible(false);
    setError("");
    try {
      await voteOnGumasta(id, profile.id, "rejected", rejectionReason.trim());
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setProcessing(false);
    }
  };

  const handleSuperadminApprove = async () => {
    if (!id) return;
    setProcessing(true);
    setError("");
    try {
      await superadminApproveGumasta(id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setProcessing(false);
    }
  };

  const openImagePreview = (uri: string) => {
    setPreviewUri(uri);
    setImagePreviewVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!gumasta) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Gumasta not found</Text>
      </View>
    );
  }

  const sebayat = (gumasta as any).sebayat;

  const statusColor =
    gumasta.approval_status === "approved"
      ? COLORS.success
      : gumasta.approval_status === "rejected"
      ? COLORS.error
      : COLORS.warning;

  const statusBg =
    gumasta.approval_status === "approved"
      ? COLORS.successLight
      : gumasta.approval_status === "rejected"
      ? COLORS.errorLight
      : COLORS.warningLight;

  const statusLabel =
    gumasta.approval_status === "approved"
      ? "Approved"
      : gumasta.approval_status === "rejected"
      ? "Rejected"
      : "Pending";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Gumasta</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Photo + Name */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            onPress={() => gumasta.photo_url && openImagePreview(gumasta.photo_url)}
            disabled={!gumasta.photo_url}
          >
            {gumasta.photo_url ? (
              <Image source={{ uri: gumasta.photo_url }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                <User size={36} color={COLORS.textMuted} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.gumastaName}>{gumasta.name}</Text>
            <View style={styles.infoRow}>
              <Phone size={14} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{gumasta.contact_number}</Text>
            </View>
            <Text style={styles.dateText}>
              Added {new Date(gumasta.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Sebayat owner info */}
        {sebayat && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sebayat Owner</Text>
            <View style={styles.card}>
              <InfoRow label="Full Name" value={sebayat.full_name} />
              {sebayat.phone_number && (
                <><View style={styles.divider} /><InfoRow label="Phone" value={sebayat.phone_number} /></>
              )}
              {sebayat.allotment_number && (
                <><View style={styles.divider} /><InfoRow label="Allotment No." value={sebayat.allotment_number} /></>
              )}
            </View>
          </View>
        )}

        {/* Aadhaar card */}
        {gumasta.aadhar_card_url && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <IdCard size={16} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Aadhaar Card</Text>
            </View>
            <TouchableOpacity onPress={() => openImagePreview(gumasta.aadhar_card_url!)}>
              <Image source={{ uri: gumasta.aadhar_card_url }} style={styles.aadharImage} />
              <Text style={styles.tapToEnlarge}>Tap to enlarge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rejection reason */}
        {gumasta.approval_status === "rejected" && gumasta.rejection_reason && (
          <View style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <XCircle size={16} color={COLORS.error} />
              <Text style={styles.rejectionTitle}>Rejection Reason</Text>
            </View>
            <Text style={styles.rejectionText}>{gumasta.rejection_reason}</Text>
          </View>
        )}

        {/* Vote progress */}
        {voteSummary && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ShieldCheck size={16} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Admin Review Progress</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.voteCountRow}>
                <VotePill label="Approved" count={voteSummary.approvedCount} color={COLORS.success} bg={COLORS.successLight} />
                <VotePill label="Rejected" count={voteSummary.rejectedCount} color={COLORS.error} bg={COLORS.errorLight} />
                <VotePill label="Pending" count={voteSummary.pendingCount} color={COLORS.warning} bg={COLORS.warningLight} />
              </View>

              {voteSummary.approvals.length > 0 && (
                <>
                  <View style={styles.divider} />
                  {voteSummary.approvals.map((a) => (
                    <View key={a.id} style={styles.voteRow}>
                      <View style={[
                        styles.voteIcon,
                        { backgroundColor: a.action === "approved" ? COLORS.successLight : COLORS.errorLight },
                      ]}>
                        {a.action === "approved"
                          ? <CheckCircle size={14} color={COLORS.success} />
                          : <XCircle size={14} color={COLORS.error} />}
                      </View>
                      <View style={styles.voteInfo}>
                        <Text style={styles.voteName}>
                          {a.admin?.full_name || "Admin"}
                          {a.admin_id === profile?.id ? " (you)" : ""}
                        </Text>
                        {a.rejection_reason ? (
                          <Text style={styles.voteReason}>{a.rejection_reason}</Text>
                        ) : null}
                        <Text style={styles.voteDate}>
                          {new Date(a.updated_at ?? a.created_at).toLocaleString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {/* My vote status */}
        {myVote && (
          <View style={[
            styles.myVoteCard,
            { backgroundColor: myVote.action === "approved" ? COLORS.successLight : COLORS.errorLight },
          ]}>
            {myVote.action === "approved"
              ? <CheckCircle size={16} color={COLORS.success} />
              : <XCircle size={16} color={COLORS.error} />}
            <Text style={[
              styles.myVoteText,
              { color: myVote.action === "approved" ? COLORS.success : COLORS.error },
            ]}>
              {myVote.action === "approved" ? "You approved this gumasta." : "You rejected this gumasta."}
            </Text>
          </View>
        )}

        {/* Superadmin force-approve when rejected */}
        {isSuperAdmin && gumasta.approval_status === "rejected" && (
          <TouchableOpacity
            style={styles.overrideBtn}
            onPress={handleSuperadminApprove}
            disabled={processing}
          >
            <ShieldCheck size={16} color={COLORS.surface} />
            <Text style={styles.overrideBtnText}>
              {processing ? "Processing..." : "Override: Force Approve"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action buttons — only show if not yet resolved and haven't voted (or voting allowed) */}
        {gumasta.approval_status === "pending" && !hasAlreadyVoted && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={handleOpenReject}
              disabled={processing}
            >
              <X size={18} color={COLORS.error} />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={handleApprove}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={COLORS.surface} />
              ) : (
                <>
                  <Check size={18} color={COLORS.surface} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Allow changing vote on pending */}
        {gumasta.approval_status === "pending" && hasAlreadyVoted && (
          <View style={styles.actionRow}>
            {myVote?.action === "rejected" && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={handleApprove}
                disabled={processing}
              >
                <Check size={18} color={COLORS.surface} />
                <Text style={styles.approveBtnText}>Change to Approve</Text>
              </TouchableOpacity>
            )}
            {myVote?.action === "approved" && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={handleOpenReject}
                disabled={processing}
              >
                <X size={18} color={COLORS.error} />
                <Text style={styles.rejectBtnText}>Change to Reject</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Gumasta</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Please provide a reason for rejection</Text>
            <TextInput
              style={[styles.reasonInput, rejectionReasonError ? styles.reasonInputError : undefined]}
              placeholder="Enter rejection reason..."
              placeholderTextColor={COLORS.textMuted}
              value={rejectionReason}
              onChangeText={(t) => { setRejectionReason(t); setRejectionReasonError(""); }}
              multiline
              numberOfLines={3}
            />
            {rejectionReasonError ? (
              <Text style={styles.fieldError}>{rejectionReasonError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalRejectBtn]}
                onPress={handleConfirmReject}
              >
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image preview modal */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setImagePreviewVisible(false)}
          >
            <X size={24} color={COLORS.surface} />
          </TouchableOpacity>
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

function VotePill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[styles.votePill, { backgroundColor: bg }]}>
      <Text style={[styles.votePillCount, { color }]}>{count}</Text>
      <Text style={[styles.votePillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    padding: SPACING.md,
  },
  errorBanner: {
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  profilePhotoPlaceholder: {
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  gumastaName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  aadharImage: {
    width: "100%",
    height: 200,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  tapToEnlarge: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  rejectionCard: {
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
  },
  rejectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  rejectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
  },
  rejectionText: {
    fontSize: 13,
    color: COLORS.error,
  },
  voteCountRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-around",
  },
  votePill: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  votePillCount: {
    fontSize: 22,
    fontWeight: "700",
  },
  votePillLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  voteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  voteInfo: {
    flex: 1,
  },
  voteName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  voteReason: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 2,
    fontStyle: "italic",
  },
  voteDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  myVoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  myVoteText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  overrideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  overrideBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.surface,
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  rejectBtn: {
    backgroundColor: COLORS.errorLight,
    borderWidth: 1,
    borderColor: COLORS.error + "60",
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.error,
  },
  approveBtn: {
    backgroundColor: COLORS.primary,
  },
  approveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceSecondary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  reasonInputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  modalCancelBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalRejectBtn: {
    backgroundColor: COLORS.error,
  },
  modalRejectText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.surface,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewClose: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  previewImage: {
    width: "100%",
    height: "80%",
  },
});
