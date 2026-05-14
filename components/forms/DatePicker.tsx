import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { COLORS } from "@/constants/config";
import { Calendar } from "lucide-react-native";

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  maxDate?: Date;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  maxDate,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date(2000, 0, 1));

  const formatDate = (date: Date | null): string => {
    if (!date) return "Select date";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const days = Array.from(
    { length: new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1
  );

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.picker, error && styles.pickerError]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={[styles.pickerText, !value && styles.placeholder]}>
          {formatDate(value)}
        </Text>
        <Calendar size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.confirmText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Day</Text>
                <View style={styles.scrollContainer}>
                  {days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.option,
                        tempDate.getDate() === day && styles.selectedOption,
                      ]}
                      onPress={() => setTempDate(new Date(tempDate.getFullYear(), tempDate.getMonth(), day))}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tempDate.getDate() === day && styles.selectedOptionText,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Month</Text>
                <View style={styles.scrollContainer}>
                  {months.map((month, index) => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.option,
                        tempDate.getMonth() === index && styles.selectedOption,
                      ]}
                      onPress={() => setTempDate(new Date(tempDate.getFullYear(), index, tempDate.getDate()))}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tempDate.getMonth() === index && styles.selectedOptionText,
                        ]}
                      >
                        {month.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Year</Text>
                <View style={styles.scrollContainer}>
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.option,
                        tempDate.getFullYear() === year && styles.selectedOption,
                      ]}
                      onPress={() => setTempDate(new Date(year, tempDate.getMonth(), tempDate.getDate()))}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          tempDate.getFullYear() === year && styles.selectedOptionText,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 8,
  },
  picker: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerError: {
    borderColor: COLORS.error,
  },
  pickerText: {
    fontSize: 16,
    color: COLORS.text,
  },
  placeholder: {
    color: COLORS.textSecondary,
  },
  error: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  pickerRow: {
    flexDirection: "row",
    padding: 16,
  },
  pickerColumn: {
    flex: 1,
    alignItems: "center",
  },
  columnLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  scrollContainer: {
    height: 200,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectedOption: {
    backgroundColor: COLORS.primaryLight,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});
