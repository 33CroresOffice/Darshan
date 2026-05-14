import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { COLORS, RADIUS, SPACING } from "@/constants/config";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const days: (string | null)[] = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(toISO(new Date(year, month, d)));
  }
  return days;
}

interface CalendarPickerProps {
  visible: boolean;
  title: string;
  selectedDate: string;
  minDate?: string;
  maxDate?: string;
  accentColor?: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function CalendarPicker({
  visible,
  title,
  selectedDate,
  minDate,
  maxDate,
  accentColor,
  onSelect,
  onClose,
}: CalendarPickerProps) {
  const initial = selectedDate ? new Date(selectedDate + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const days = buildCalendarDays(viewYear, viewMonth);
  const today = toISO(new Date());
  const color = accentColor || COLORS.primary;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const isDisabled = (dateStr: string) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
              <ChevronLeft size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.monthYear}>{FULL_MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
              <ChevronRight size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map((d) => (
              <Text key={d} style={styles.dayName}>{d}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((dateStr, i) => {
              if (!dateStr) return <View key={`empty-${i}`} style={styles.dayCell} />;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const disabled = isDisabled(dateStr);
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && [styles.dayCellSelected, { backgroundColor: color }],
                    isToday && !isSelected && [styles.dayCellToday, { borderColor: color }],
                    disabled && styles.dayCellDisabled,
                  ]}
                  onPress={() => !disabled && onSelect(dateStr)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && [styles.dayTextToday, { color }],
                      disabled && styles.dayTextDisabled,
                    ]}
                  >
                    {parseInt(dateStr.split("-")[2], 10)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 340,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  monthYear: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  dayNamesRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    paddingVertical: 4,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.sm,
  },
  dayCellSelected: {
    borderRadius: RADIUS.sm,
  },
  dayCellToday: {
    borderWidth: 1,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.text,
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayTextToday: {
    fontWeight: "600",
  },
  dayTextDisabled: {
    color: COLORS.textMuted,
  },
  cancelBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
});
