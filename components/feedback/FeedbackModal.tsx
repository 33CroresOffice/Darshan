import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { X, MessageSquare, Send, CircleCheck as CheckCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  role: "supervisor" | "sebayat";
}

const MAX_WORDS = 50;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function FeedbackModal({ visible, onClose, userId, role }: FeedbackModalProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = countWords(message);
  const isOverLimit = wordCount > MAX_WORDS;
  const isEmpty = message.trim().length === 0;

  const handleChange = (text: string) => {
    setError(null);
    setMessage(text);
  };

  const handleSubmit = async () => {
    if (isEmpty || isOverLimit) return;
    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("feedback").insert({
        user_id: userId,
        role,
        message: message.trim(),
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      setError(t('feedback.failedSubmit'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage("");
    setError(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <MessageSquare size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.title}>{t('feedback.title')}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <CheckCircle size={40} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>{t('feedback.successTitle')}</Text>
              <Text style={styles.successSubtitle}>
                {t('feedback.successSubtitle')}
              </Text>
              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>{t('feedback.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                {t('feedback.subtitle', { max: MAX_WORDS })}
              </Text>

              <View style={[styles.inputWrap, isOverLimit && styles.inputWrapError]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('feedback.placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={5}
                  value={message}
                  onChangeText={handleChange}
                  maxLength={400}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.footer}>
                <Text style={[styles.wordCount, isOverLimit && styles.wordCountError]}>
                  {t('feedback.wordCount', { count: wordCount, max: MAX_WORDS })}
                </Text>
                {error && <Text style={styles.errorText}>{error}</Text>}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (isEmpty || isOverLimit || loading) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isEmpty || isOverLimit || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>{t('feedback.submit')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    ...SHADOWS.large,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    minHeight: 120,
  },
  inputWrapError: {
    borderColor: COLORS.error,
  },
  input: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    minHeight: 96,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  wordCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  wordCountError: {
    color: COLORS.error,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    flex: 1,
    textAlign: "right",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.disabled,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  successIcon: {
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
