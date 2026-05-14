import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { COLORS } from "@/constants/config";

const { width, height } = Dimensions.get("window");

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.background}>
        <View style={styles.topCircle} />
        <View style={styles.bottomCircle} />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <View style={styles.logoInner}>
            <Text style={styles.logoSymbol}>ଶ୍ରୀ</Text>
          </View>
          <View style={styles.logoRing} />
        </Animated.View>

        <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
          ଶ୍ରୀ ଜଗନ୍ନାଥ
        </Animated.Text>
        <Animated.Text style={[styles.titleEn, { opacity: textOpacity }]}>
          Sebayat Portal
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          ସେବାୟତ ପ୍ରବେଶ ପ୍ରଣାଳୀ
        </Animated.Text>
      </View>

      <Animated.View style={[styles.footer, { opacity: subtitleOpacity }]}>
        <View style={styles.footerDot} />
        <View style={[styles.footerDot, styles.footerDotActive]} />
        <View style={styles.footerDot} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f4c35",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  topCircle: {
    position: "absolute",
    top: -height * 0.15,
    right: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bottomCircle: {
    position: "absolute",
    bottom: -height * 0.1,
    left: -width * 0.25,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  logoInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  logoSymbol: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  titleEn: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  footer: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  footerDotActive: {
    width: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
