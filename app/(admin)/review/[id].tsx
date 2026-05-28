import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  X,
  ZoomIn,
  Check,
  Circle as XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RotateCcw,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import {
  getRegistrationById,
  approveRegistration,
  rejectRegistration,
  overrideApproveRejected,
  getRegistrationVotes,
  getPreviousRoundVotes,
} from "@/services/adminService";
import { getApprovalRule, type ApprovalRule } from "@/services/settingsService";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/actions/Button";
import { StatusBadge } from "@/components/display/StatusBadge";
import { LoadingOverlay } from "@/components/actions/LoadingOverlay";
import { COLORS, SHADOWS, RADIUS, SPACING } from "@/constants/config";
import type {
  SebayatRegistration,
  AdminVoteSummary,
  RegistrationApproval,
  PreviousRoundVotes,
} from "@/types";

export default function ReviewScreen() {
  const tabBarHeight = 0;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [registration, setRegistration] = useState<SebayatRegistration | null>(null);
  const [voteSummary, setVoteSummary] = useState<AdminVoteSummary | null>(null);
  const [previousRounds, setPreviousRounds] = useState<PreviousRoundVotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showOverrideApproveModal, setShowOverrideApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState<"wrong_data" | "management_decision" | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showChangeVote, setShowChangeVote] = useState(false);
  const [approvalRule, setApprovalRule] = useState<ApprovalRule>("all_admins");

  const fetchData = async () => {
    if (!id) return;
    try {
      const [reg, votes, rule] = await Promise.all([
        getRegistrationById(id),
        getRegistrationVotes(id),
        getApprovalRule(),
      ]);
      setRegistration(reg);
      setVoteSummary(votes);
      setApprovalRule(rule);

      if (votes && votes.submissionRound > 1) {
        const prevRounds = await getPreviousRoundVotes(id, votes.submissionRound);
        setPreviousRounds(prevRounds);
      } else {
        setPreviousRounds([]);
      }
    } catch (err) {
      console.error("Failed to fetch registration:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`review-${id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "registration_approvals",
        filter: `registration_id=eq.${id}`,
      }, () => {
        fetchData();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "sebayat_registrations",
        filter: `id=eq.${id}`,
      }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const myVote = voteSummary?.approvals.find((a) => a.admin_id === user?.id);
  const hasVoted = !!myVote;
  const myVoteAction = myVote?.action;

  const isCarriedForward = (() => {
    if (!hasVoted || myVoteAction !== "approved") return false;
    if (!voteSummary || voteSummary.submissionRound <= 1) return false;
    const prevRound = previousRounds.find((r) => r.round === voteSummary.submissionRound - 1);
    if (!prevRound) return false;
    return prevRound.approvals.some((a) => a.admin_id === user?.id && a.action === "approved");
  })();

  const hadPreviouslyRejected = (() => {
    if (!user || !previousRounds.length) return false;
    for (const round of previousRounds) {
      if (round.approvals.some((a) => a.admin_id === user.id && a.action === "rejected")) {
        return true;
      }
    }
    return false;
  })();

  const showActionButtons =
    registration?.approval_status === "pending" &&
    ((!hasVoted) || (isCarriedForward && showChangeVote));

  const handleApprove = async () => {
    if (!registration || !user) return;
    setActionLoading(true);
    try {
      await approveRegistration(registration.id, user.id);
      setShowChangeVote(false);
      await fetchData();
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!registration || !user || !rejectReason.trim() || !rejectType) return;
    setActionLoading(true);
    try {
      await rejectRegistration(registration.id, user.id, rejectReason, rejectType);
      setShowRejectModal(false);
      setRejectReason("");
      setRejectType(null);
      setShowChangeVote(false);
      await fetchData();
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverrideApprove = async () => {
    if (!registration || !user) return;
    setActionLoading(true);
    try {
      await overrideApproveRejected(registration.id, user.id);
      setShowOverrideApproveModal(false);
      await fetchData();
    } catch (err) {
      console.error("Failed to override approve:", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Loading..." />;
  }

  if (!registration) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Registration not found</Text>
      </SafeAreaView>
    );
  }

  const isResubmission = registration.submission_round > 1;
  const oldData = registration.old_data;
  const hasDiff = isResubmission && !!oldData;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>Review Application</Text>
          {isResubmission && (
            <Text style={styles.roundBadge}>Round {registration.submission_round}</Text>
          )}
        </View>
        <StatusBadge status={registration.approval_status} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={() => setEnlargedImage(registration.photo_url)}>
            <Image
              source={{ uri: registration.photo_url }}
              style={styles.photo}
            />
            <View style={styles.zoomHint}>
              <ZoomIn size={16} color={COLORS.surface} />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{registration.full_name}</Text>
          {hasDiff && oldData?.photo_url && oldData.photo_url !== registration.photo_url && (
            <View style={styles.photoChangedBadge}>
              <Text style={styles.photoChangedText}>Photo updated</Text>
            </View>
          )}
        </View>

        {hasDiff && oldData && (
          <View style={styles.section}>
            <View style={styles.diffSectionHeader}>
              <RotateCcw size={15} color={COLORS.accent} />
              <Text style={styles.diffSectionTitle}>What Changed (Round {registration.submission_round - 1} → {registration.submission_round})</Text>
            </View>
            <View style={styles.diffCard}>
              <DiffRow
                label="Full Name"
                oldValue={oldData.full_name}
                newValue={registration.full_name}
              />
              <DiffRow
                label="Temple Health Card ID"
                oldValue={oldData.temple_health_card_id}
                newValue={registration.temple_health_card_id}
              />
              {oldData.temple_health_card_url !== registration.temple_health_card_url && (
                <View style={styles.diffImageRow}>
                  <Text style={styles.diffLabel}>Temple Health Card Image</Text>
                  <View style={styles.diffImages}>
                    {oldData.temple_health_card_url ? (
                      <TouchableOpacity style={styles.diffImageBox} onPress={() => setEnlargedImage(oldData.temple_health_card_url!)}>
                        <Image source={{ uri: oldData.temple_health_card_url }} style={styles.diffImage} resizeMode="cover" />
                        <Text style={styles.diffImageLabel}>Previous</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.diffImageBox}>
                        <View style={styles.diffImageMissing}><Text style={styles.diffImageMissingText}>None</Text></View>
                        <Text style={styles.diffImageLabel}>Previous</Text>
                      </View>
                    )}
                    <View style={styles.diffArrow}>
                      <ArrowRight size={16} color={COLORS.textMuted} />
                    </View>
                    {registration.temple_health_card_url ? (
                      <TouchableOpacity style={styles.diffImageBox} onPress={() => setEnlargedImage(registration.temple_health_card_url!)}>
                        <Image source={{ uri: registration.temple_health_card_url }} style={styles.diffImage} resizeMode="cover" />
                        <Text style={[styles.diffImageLabel, styles.diffImageLabelNew]}>Updated</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.diffImageBox}>
                        <View style={styles.diffImageMissing}><Text style={styles.diffImageMissingText}>Removed</Text></View>
                        <Text style={[styles.diffImageLabel, styles.diffImageLabelNew]}>Updated</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration Details</Text>
          <View style={styles.card}>
            <InfoRow label="Full Name" value={registration.full_name} />
            <InfoRow label="Father's Name" value={registration.father_name || "-"} />
            <InfoRow label="Age" value={registration.age != null ? String(registration.age) : "-"} />
            <InfoRow label="Mobile Number" value={registration.phone_number || "-"} />
            <InfoRow label="Nijog / Category" value={registration.category?.name || "-"} />
            <InfoRow label="Allotment Number" value={registration.allotment_number || "-"} />
            <InfoRow label="Aadhaar Number" value={registration.aadhar_number || "-"} />
            <InfoRow label="Temple Health Card ID" value={registration.temple_health_card_id || "-"} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Details</Text>
          <View style={styles.card}>
            <Text style={styles.addressSubheading}>Permanent Address</Text>
            {registration.permanent_address || registration.permanent_city || registration.permanent_state ? (
              <>
                <InfoRow label="Address" value={registration.permanent_address || "-"} />
                <InfoRow label="City / Village" value={registration.permanent_city || "-"} />
                <InfoRow label="State" value={registration.permanent_state || "-"} />
                <InfoRow label="Pincode" value={registration.permanent_pincode || "-"} />
              </>
            ) : (
              <Text style={styles.addressNotProvided}>Not provided</Text>
            )}

            {registration.present_same_as_permanent ? (
              <View style={styles.sameAddressBadge}>
                <Text style={styles.sameAddressBadgeText}>Present address same as permanent</Text>
              </View>
            ) : (
              <>
                <View style={styles.addressDivider} />
                <Text style={styles.addressSubheading}>Present Address</Text>
                {registration.present_address || registration.present_city || registration.present_state ? (
                  <>
                    <InfoRow label="Address" value={registration.present_address || "-"} />
                    <InfoRow label="City / Village" value={registration.present_city || "-"} />
                    <InfoRow label="State" value={registration.present_state || "-"} />
                    <InfoRow label="Pincode" value={registration.present_pincode || "-"} />
                  </>
                ) : (
                  <Text style={styles.addressNotProvided}>Not provided</Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {registration.temple_health_card_url ? (
            <TouchableOpacity
              style={styles.documentContainer}
              onPress={() => setEnlargedImage(registration.temple_health_card_url!)}
            >
              <Text style={styles.documentLabel}>Temple Health Card</Text>
              <View style={styles.documentWrapper}>
                <Image
                  source={{ uri: registration.temple_health_card_url }}
                  style={styles.documentImage}
                  resizeMode="contain"
                />
                <View style={styles.documentZoomHint}>
                  <ZoomIn size={14} color={COLORS.surface} />
                  <Text style={styles.documentZoomText}>Tap to enlarge</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.documentMissing}>
              <Text style={styles.documentMissingText}>No temple health card uploaded</Text>
            </View>
          )}
          {registration.aadhar_card_url ? (
            <TouchableOpacity
              style={[styles.documentContainer, { marginTop: 12 }]}
              onPress={() => setEnlargedImage(registration.aadhar_card_url!)}
            >
              <Text style={styles.documentLabel}>Aadhaar Card</Text>
              <View style={styles.documentWrapper}>
                <Image
                  source={{ uri: registration.aadhar_card_url }}
                  style={styles.documentImage}
                  resizeMode="contain"
                />
                <View style={styles.documentZoomHint}>
                  <ZoomIn size={14} color={COLORS.surface} />
                  <Text style={styles.documentZoomText}>Tap to enlarge</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.documentMissing, { marginTop: 12 }]}>
              <Text style={styles.documentMissingText}>No Aadhaar card uploaded</Text>
            </View>
          )}
        </View>

        {voteSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Review Progress</Text>
            <View style={styles.voteSummaryBar}>
              <View style={styles.voteCountRow}>
                <View style={styles.voteCountItem}>
                  <View style={[styles.voteCountDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.voteCountText}>{voteSummary.approvedCount} approved</Text>
                </View>
                {voteSummary.rejectedCount > 0 && (
                  <View style={styles.voteCountItem}>
                    <View style={[styles.voteCountDot, { backgroundColor: COLORS.error }]} />
                    <Text style={styles.voteCountText}>{voteSummary.rejectedCount} rejected</Text>
                  </View>
                )}
                {voteSummary.pendingCount > 0 && (
                  <View style={styles.voteCountItem}>
                    <View style={[styles.voteCountDot, { backgroundColor: COLORS.textMuted }]} />
                    <Text style={styles.voteCountText}>{voteSummary.pendingCount} need to review</Text>
                  </View>
                )}
              </View>
              <Text style={styles.voteSubtext}>
                {approvalRule === "all_admins" && `All ${voteSummary.totalAdmins} admin${voteSummary.totalAdmins !== 1 ? "s" : ""} must approve`}
                {approvalRule === "majority" && `Majority required — ${voteSummary.approvedCount} of ${voteSummary.totalAdmins} approved`}
                {approvalRule === "any_admin" && `Any admin approval is sufficient — ${voteSummary.approvedCount} of ${voteSummary.totalAdmins} approved`}
                {approvalRule === "superadmin_only" && `Admin votes are recorded for reference only — awaiting Super Admin approval`}
              </Text>
            </View>

            {approvalRule === "superadmin_only" && (
              <View style={styles.superadminOnlyBanner}>
                <Clock size={15} color="#92400E" />
                <Text style={styles.superadminOnlyBannerText}>
                  Current rule: Super Admin Only. Your vote is saved for audit purposes but does not affect the registration status.
                </Text>
              </View>
            )}

            {hadPreviouslyRejected && !hasVoted && registration.approval_status === "pending" && (
              <View style={styles.revoteNotice}>
                <XCircle size={16} color={COLORS.error} />
                <Text style={styles.revoteNoticeText}>
                  You rejected this application in a previous round. Please review the changes above and cast your vote for this round.
                </Text>
              </View>
            )}

            <View style={styles.card}>
              {voteSummary.approvals.map((approval) => (
                <VoteRow
                  key={approval.id}
                  approval={approval}
                  isCurrentUser={approval.admin_id === user?.id}
                  isCarriedForward={
                    isCarriedForward && approval.admin_id === user?.id
                  }
                />
              ))}
              {voteSummary.pendingCount > 0 && (
                <View style={styles.pendingAdminsNote}>
                  <Clock size={14} color={COLORS.textMuted} />
                  <Text style={styles.pendingAdminsText}>
                    {voteSummary.pendingCount} admin{voteSummary.pendingCount > 1 ? "s need" : " needs"} to review this round
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {isCarriedForward && registration.approval_status === "pending" && !showChangeVote && (
          <View style={styles.carriedForwardNotice}>
            <Check size={16} color={COLORS.success} />
            <View style={styles.carriedForwardTextGroup}>
              <Text style={styles.carriedForwardTitle}>Approval carried forward</Text>
              <Text style={styles.carriedForwardSubtext}>
                Your previous approval has been automatically applied to this round.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowChangeVote(true)} style={styles.changeVoteLink}>
              <Text style={styles.changeVoteLinkText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasVoted && !isCarriedForward && registration.approval_status === "pending" && (
          <View style={[
            styles.myVoteNotice,
            myVoteAction === "approved" ? styles.myVoteNoticeApproved : styles.myVoteNoticeRejected,
          ]}>
            {myVoteAction === "approved" ? (
              <Check size={18} color={COLORS.success} />
            ) : (
              <XCircle size={18} color={COLORS.error} />
            )}
            <Text style={[
              styles.myVoteNoticeText,
              myVoteAction === "approved" ? styles.myVoteNoticeTextApproved : styles.myVoteNoticeTextRejected,
            ]}>
              {myVoteAction === "approved"
                ? "You approved this application."
                : "You rejected this application."}
            </Text>
          </View>
        )}

        {previousRounds.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.historyToggle}
              onPress={() => setHistoryExpanded((v) => !v)}
            >
              <Text style={styles.historyToggleTitle}>Previous Submission History</Text>
              <View style={styles.historyRoundCount}>
                <Text style={styles.historyRoundCountText}>{previousRounds.length} round{previousRounds.length > 1 ? "s" : ""}</Text>
                {historyExpanded ? (
                  <ChevronUp size={16} color={COLORS.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={COLORS.textSecondary} />
                )}
              </View>
            </TouchableOpacity>

            {historyExpanded && previousRounds.map((roundData) => (
              <PreviousRoundCard
                key={roundData.round}
                roundData={roundData}
                currentUserId={user?.id}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {showActionButtons && (
        <View style={styles.footer}>
          <Button
            title={myVoteAction === "rejected" ? "Rejected" : "Reject"}
            onPress={() => setShowRejectModal(true)}
            variant="danger"
            style={styles.actionButton}
          />
          <Button
            title={myVoteAction === "approved" ? "Approved" : "Approve"}
            onPress={handleApprove}
            loading={actionLoading}
            style={styles.actionButton}
          />
        </View>
      )}

      {registration?.approval_status === "rejected" && myVoteAction === "rejected" && (
        <View style={styles.footer}>
          <Button
            title="Approve Application"
            onPress={() => setShowOverrideApproveModal(true)}
            style={styles.actionButton}
          />
        </View>
      )}

      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejection
            </Text>
            <Text style={styles.modalSectionLabel}>Rejection Type</Text>
            <View style={styles.rejectTypeRow}>
              <TouchableOpacity
                style={[
                  styles.rejectTypeOption,
                  rejectType === "wrong_data" && styles.rejectTypeOptionActive,
                ]}
                onPress={() => setRejectType("wrong_data")}
              >
                <View style={[styles.rejectTypeRadio, rejectType === "wrong_data" && styles.rejectTypeRadioActive]}>
                  {rejectType === "wrong_data" && <View style={styles.rejectTypeRadioDot} />}
                </View>
                <View style={styles.rejectTypeTextBlock}>
                  <Text style={[styles.rejectTypeLabel, rejectType === "wrong_data" && styles.rejectTypeLabelActive]}>
                    Wrong Data
                  </Text>
                  <Text style={styles.rejectTypeDesc}>Applicant can resubmit with corrections</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rejectTypeOption,
                  rejectType === "management_decision" && styles.rejectTypeOptionActive,
                ]}
                onPress={() => setRejectType("management_decision")}
              >
                <View style={[styles.rejectTypeRadio, rejectType === "management_decision" && styles.rejectTypeRadioActive]}>
                  {rejectType === "management_decision" && <View style={styles.rejectTypeRadioDot} />}
                </View>
                <View style={styles.rejectTypeTextBlock}>
                  <Text style={[styles.rejectTypeLabel, rejectType === "management_decision" && styles.rejectTypeLabelActive]}>
                    Management Decision
                  </Text>
                  <Text style={styles.rejectTypeDesc}>Resubmit option will be hidden</Text>
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                  setRejectType(null);
                }}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Reject"
                onPress={handleReject}
                variant="danger"
                loading={actionLoading}
                disabled={!rejectReason.trim() || !rejectType}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showOverrideApproveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Approve Application</Text>
            <Text style={styles.modalSubtitle}>
              This application was previously rejected. Are you sure you want to approve it? The applicant will be notified immediately.
            </Text>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowOverrideApproveModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Approve"
                onPress={handleOverrideApprove}
                loading={actionLoading}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {actionLoading && <LoadingOverlay message="Processing..." />}

      <Modal visible={!!enlargedImage} transparent animationType="fade">
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setEnlargedImage(null)}
          >
            <X size={24} color={COLORS.surface} />
          </TouchableOpacity>
          {enlargedImage && (
            <Image
              source={{ uri: enlargedImage }}
              style={styles.enlargedImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DiffRow({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string | null | undefined;
  newValue: string | null | undefined;
}) {
  const old = oldValue || "-";
  const current = newValue || "-";
  const changed = old !== current;

  if (!changed) return null;

  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>{label}</Text>
      <View style={styles.diffValues}>
        <Text style={styles.diffOldValue}>{old}</Text>
        <ArrowRight size={14} color={COLORS.textMuted} />
        <Text style={styles.diffNewValue}>{current}</Text>
      </View>
    </View>
  );
}

function VoteRow({
  approval,
  isCurrentUser,
  isCarriedForward,
}: {
  approval: RegistrationApproval;
  isCurrentUser: boolean;
  isCarriedForward: boolean;
}) {
  const isApproved = approval.action === "approved";
  const actionDate = new Date(approval.updated_at);
  const formattedDate = actionDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = actionDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <View style={styles.voteRow}>
      <View style={[styles.voteIcon, isApproved ? styles.voteIconApproved : styles.voteIconRejected]}>
        {isApproved ? (
          <Check size={14} color={COLORS.surface} />
        ) : (
          <XCircle size={14} color={COLORS.surface} />
        )}
      </View>
      <View style={styles.voteInfo}>
        <Text style={styles.voteAdminName}>
          {approval.admin?.full_name || approval.admin?.phone_number || "Admin"}
          {isCurrentUser && <Text style={styles.youBadge}> (you)</Text>}
        </Text>
        <Text style={styles.voteDateTime}>{formattedDate} at {formattedTime}</Text>
        {isCarriedForward && (
          <Text style={styles.carriedForwardTag}>carried forward from previous round</Text>
        )}
        {!isApproved && approval.rejection_reason && (
          <Text style={styles.voteRejectionReason}>{approval.rejection_reason}</Text>
        )}
      </View>
      <Text style={[styles.voteActionLabel, isApproved ? styles.voteApprovedLabel : styles.voteRejectedLabel]}>
        {isApproved ? "Approved" : "Rejected"}
      </Text>
    </View>
  );
}

function PreviousRoundCard({
  roundData,
  currentUserId,
}: {
  roundData: PreviousRoundVotes;
  currentUserId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const approvedCount = roundData.approvals.filter((a) => a.action === "approved").length;
  const rejectedCount = roundData.approvals.filter((a) => a.action === "rejected").length;

  return (
    <View style={styles.prevRoundCard}>
      <TouchableOpacity
        style={styles.prevRoundHeader}
        onPress={() => setExpanded((v) => !v)}
      >
        <View>
          <Text style={styles.prevRoundTitle}>Round {roundData.round} Review</Text>
          <Text style={styles.prevRoundSummary}>
            {approvedCount} approved · {rejectedCount} rejected
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} color={COLORS.textSecondary} />
        ) : (
          <ChevronDown size={16} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
      {expanded && roundData.approvals.map((approval) => (
        <VoteRow
          key={approval.id}
          approval={approval}
          isCurrentUser={approval.admin_id === currentUserId}
          isCarriedForward={false}
        />
      ))}
    </View>
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
    padding: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  roundBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
    backgroundColor: COLORS.border,
  },
  zoomHint: {
    position: "absolute",
    bottom: 16,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  photoChangedBadge: {
    marginTop: 6,
    backgroundColor: COLORS.accentLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  photoChangedText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.accent,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.medium,
  },
  diffSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  diffSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.accent,
  },
  diffCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
    padding: 16,
    ...SHADOWS.small,
  },
  diffRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  diffLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: "500",
  },
  diffValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  diffOldValue: {
    fontSize: 13,
    color: COLORS.textMuted,
    textDecorationLine: "line-through",
    flex: 1,
  },
  diffNewValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
  },
  diffImageRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  diffImages: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  diffImageBox: {
    flex: 1,
  },
  diffImage: {
    width: "100%",
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
  },
  diffImageMissing: {
    width: "100%",
    height: 90,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  diffImageMissingText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  diffImageLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  diffImageLabelNew: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  diffArrow: {
    alignSelf: "center",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
    textTransform: "capitalize",
  },
  addressSubheading: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  addressDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  addressNotProvided: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  sameAddressBadge: {
    marginTop: 14,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  sameAddressBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  documentContainer: {
    width: "100%",
  },
  documentLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  documentWrapper: {
    position: "relative",
  },
  documentImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  documentZoomHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  documentZoomText: {
    fontSize: 12,
    color: COLORS.surface,
  },
  documentMissing: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  documentMissingText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  voteSummaryBar: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.medium,
  },
  voteCountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 8,
  },
  voteCountItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voteCountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voteCountText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  voteSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  superadminOnlyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  superadminOnlyBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  revoteNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  revoteNoticeText: {
    fontSize: 13,
    color: COLORS.error,
    flex: 1,
    lineHeight: 18,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  voteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  voteIconApproved: {
    backgroundColor: COLORS.success,
  },
  voteIconRejected: {
    backgroundColor: COLORS.error,
  },
  voteInfo: {
    flex: 1,
  },
  voteAdminName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  youBadge: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textSecondary,
  },
  voteDateTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  carriedForwardTag: {
    fontSize: 11,
    color: COLORS.accent,
    marginTop: 2,
    fontStyle: "italic",
  },
  voteRejectionReason: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  voteActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "center",
  },
  voteApprovedLabel: {
    color: COLORS.success,
  },
  voteRejectedLabel: {
    color: COLORS.error,
  },
  pendingAdminsNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  pendingAdminsText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  carriedForwardNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  carriedForwardTextGroup: {
    flex: 1,
  },
  carriedForwardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.success,
  },
  carriedForwardSubtext: {
    fontSize: 12,
    color: COLORS.success,
    opacity: 0.8,
    marginTop: 2,
  },
  changeVoteLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeVoteLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  myVoteNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  myVoteNoticeApproved: {
    backgroundColor: "#F0FDF4",
    borderColor: COLORS.success,
  },
  myVoteNoticeRejected: {
    backgroundColor: "#FFF1F2",
    borderColor: COLORS.error,
  },
  myVoteNoticeText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  myVoteNoticeTextApproved: {
    color: COLORS.success,
  },
  myVoteNoticeTextRejected: {
    color: COLORS.error,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  historyToggleTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  historyRoundCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyRoundCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  prevRoundCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  prevRoundHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  prevRoundTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  prevRoundSummary: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    textAlign: "center",
    marginTop: 100,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rejectTypeRow: {
    gap: 8,
    marginBottom: 16,
  },
  rejectTypeOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORS.background,
  },
  rejectTypeOptionActive: {
    borderColor: COLORS.error,
    backgroundColor: "#FFF5F5",
  },
  rejectTypeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  rejectTypeRadioActive: {
    borderColor: COLORS.error,
  },
  rejectTypeRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  rejectTypeTextBlock: {
    flex: 1,
  },
  rejectTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  rejectTypeLabelActive: {
    color: COLORS.error,
  },
  rejectTypeDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  reasonInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  enlargedImage: {
    width: "90%",
    height: "80%",
  },
});
