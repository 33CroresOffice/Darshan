import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from "react-native";
import { User, X, UserCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  assignGumastaToTickets,
  removeGumastaFromTicket,
} from "@/services/gumastaService";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/config";
import type { Gumasta } from "@/types/database";

interface Props {
  ticketId: string;
  currentGumastaId: string | null;
  currentGumastaName?: string | null;
  currentGumastaPhoto?: string | null;
  gumastas: Gumasta[];
  onAssigned: (gumastaId: string | null) => void;
  onMutationStart?: () => void;
}

export function GumastaAssignButton({
  ticketId,
  currentGumastaId,
  currentGumastaName,
  currentGumastaPhoto,
  gumastas,
  onAssigned,
  onMutationStart,
}: Props) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleAssign = async (gumastaId: string) => {
    onMutationStart?.();
    onAssigned(gumastaId);
    setModalVisible(false);
    try {
      await assignGumastaToTickets([ticketId], gumastaId);
    } catch {
      onAssigned(currentGumastaId);
    }
  };

  const handleRemove = async () => {
    onMutationStart?.();
    onAssigned(null);
    try {
      await removeGumastaFromTicket(ticketId);
    } catch {
      onAssigned(currentGumastaId);
    }
  };

  if (currentGumastaId) {
    return (
      <View style={styles.assignedRow}>
        {currentGumastaPhoto ? (
          <Image source={{ uri: currentGumastaPhoto }} style={styles.miniAvatar} />
        ) : (
          <UserCheck size={14} color={COLORS.primary} />
        )}
        <Text style={styles.assignedName} numberOfLines={1}>
          {currentGumastaName || t("gumasta.assignedTo")}
        </Text>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  if (gumastas.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.assignBtn}
        onPress={(e) => {
          e.stopPropagation();
          setModalVisible(true);
        }}
      >
        <User size={12} color={COLORS.primary} />
        <Text style={styles.assignBtnText}>{t("gumasta.assignGumasta")}</Text>
      </TouchableOpacity>

      {modalVisible && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.overlayBackdrop}
              activeOpacity={1}
              onPress={() => setModalVisible(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t("gumasta.selectGumasta")}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={gumastas}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gumastaItem}
                    onPress={() => handleAssign(item.id)}
                  >
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <User size={18} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPhone}>{item.contact_number}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(13, 148, 136, 0.08)",
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
  },
  miniAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  assignedName: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "500",
    maxWidth: 100,
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
    opacity: 0.8,
  },
  assignBtnText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  overlayBackdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: "60%",
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  gumastaItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
