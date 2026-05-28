import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ChartBar as BarChart3,
  FileText,
  Users,
  Shield,
  Heart,
  ChevronRight,
  TrendingUp,
  Table2,
  Timer,
  MessageSquare,
} from "lucide-react-native";
import { COLORS, SHADOWS, SPACING, RADIUS } from "@/constants/config";

interface InsightCard {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
  route: string;
}

export default function InsightsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

  const analyticsCards: InsightCard[] = [
    {
      title: "Overview Analytics",
      subtitle: "View trends, entries, and key metrics",
      icon: <BarChart3 size={24} color="#3B82F6" />,
      iconBgColor: "#DBEAFE",
      route: "/(admin)/analytics",
    },
    {
      title: "Devotee Analytics",
      subtitle: "Track devotee visits and patterns",
      icon: <Heart size={24} color="#EC4899" />,
      iconBgColor: "#FCE7F3",
      route: "/(admin)/devotee-analytics",
    },
  ];

  const reportCards: InsightCard[] = [
    {
      title: "Entry Reports",
      subtitle: "Generate and view entry reports",
      icon: <FileText size={24} color="#F59E0B" />,
      iconBgColor: "#FEF3C7",
      route: "/(admin)/reports",
    },
    {
      title: "Darshan Reports",
      subtitle: "View individual Darshan analytics",
      icon: <Users size={24} color="#10B981" />,
      iconBgColor: "#D1FAE5",
      route: "/(admin)/sebayat-reports",
    },
    {
      title: "Supervisor Reports",
      subtitle: "View supervisor activity analytics",
      icon: <Shield size={24} color="#8B5CF6" />,
      iconBgColor: "#EDE9FE",
      route: "/(admin)/supervisor-reports",
    },
    {
      title: "All Darshan Data",
      subtitle: "Quota usage table by date and filters",
      icon: <Table2 size={24} color="#0D9488" />,
      iconBgColor: "#CCFBF1",
      route: "/(admin)/all-sebayat-data",
    },
    {
      title: "Slot Session Reports",
      subtitle: "Who started & ended each slot, with full timestamps",
      icon: <Timer size={24} color="#2563EB" />,
      iconBgColor: "#DBEAFE",
      route: "/(admin)/slot-session-reports",
    },
    {
      title: "Feedback",
      subtitle: "View feedback submitted by supervisors and sebayat",
      icon: <MessageSquare size={24} color="#F59E0B" />,
      iconBgColor: "#FEF3C7",
      route: "/(admin)/feedback",
    },
  ];

  const renderCard = (card: InsightCard) => (
    <TouchableOpacity
      key={card.title}
      style={styles.card}
      onPress={() => router.push(card.route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardIcon, { backgroundColor: card.iconBgColor }]}>
        {card.icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
      </View>
      <ChevronRight size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <TrendingUp size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>
            Access analytics and reports to track performance
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analytics</Text>
          <View style={styles.cardsContainer}>
            {analyticsCards.map(renderCard)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports</Text>
          <View style={styles.cardsContainer}>
            {reportCards.map(renderCard)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 280,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.small,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
});
