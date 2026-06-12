import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { T } from '../styles/global';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FadeInOnScroll: React.FC<{ children: React.ReactNode; scrollY: Animated.Value }> = ({ children, scrollY }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [viewTop, setViewTop] = React.useState<number | null>(null);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (viewTop !== null && value + SCREEN_HEIGHT - 80 >= viewTop) {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, viewTop, fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }} onLayout={e => setViewTop(e.nativeEvent.layout.y)}>
      {children}
    </Animated.View>
  );
};

const TEAM = [
  {
    id: 'joseph',
    tag: '// 01',
    name: 'JOSEPH CHENG',
    school: 'New York University',
    degree: 'CS & Mathematics',
    bio: 'Hi! I\'m Joe, and I love problem-solving and exploring the fun side of game theory. The Hi-Lo Trading Game was born out of my fascination with quantitative finance, blending the excitement of trading with a game anyone can enjoy. When I\'m not working on projects like this, you\'ll find me exploring NYC with friends, playing basketball, or contemplating my life\'s hidden purpose.',
    links: [
      { icon: 'logo-instagram' as const, url: 'https://www.instagram.com/koioseph_/', label: 'INSTAGRAM' },
      { icon: 'logo-linkedin' as const, url: 'https://www.linkedin.com/in/joseph-cheng-b03886296', label: 'LINKEDIN' },
      { icon: 'logo-github' as const, url: 'https://github.com/jxc2008', label: 'GITHUB' },
      { icon: 'mail' as const, url: 'mailto:joseph.x.cheng@gmail.com', label: 'EMAIL' },
    ],
  },
  {
    id: 'brian',
    tag: '// 02',
    name: 'BRIAN LI',
    school: 'University of Illinois',
    degree: 'Computer Science',
    bio: 'I started out with competitive programming but found my joy in creating applications everyone can use. Outside of coding, I love trying different kinds of ice cream, playing sports like volleyball or basketball, and traveling wherever I can. I\'m always looking for new opportunities to learn and grow.',
    links: [
      { icon: 'logo-instagram' as const, url: 'https://www.instagram.com/librianli/', label: 'INSTAGRAM' },
      { icon: 'logo-linkedin' as const, url: 'https://www.linkedin.com/in/librianli/', label: 'LINKEDIN' },
      { icon: 'logo-github' as const, url: 'https://github.com/ExtraMediumDev', label: 'GITHUB' },
      { icon: 'mail' as const, url: 'mailto:brian3092li@gmail.com', label: 'EMAIL' },
    ],
  },
];

const STACK = [
  { label: 'FRONTEND', value: 'React Native / Expo' },
  { label: 'BACKEND', value: 'Flask + Python' },
  { label: 'DATABASE', value: 'MongoDB Atlas' },
  { label: 'REALTIME', value: 'Socket.IO' },
  { label: 'HOSTING', value: 'Vercel + Render' },
];

export default function About() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    'Orbitron': require('../assets/fonts/Orbitron-Bold.ttf'),
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarBrand}>HI-LO TRADING TERMINAL</Text>
          <Text style={styles.topBarSection}>// ABOUT</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={e => scrollY.setValue(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          <View style={styles.inner}>

            {/* Page header */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>THE TEAM</Text>
              <Text style={styles.pageSubtitle}>HI-LO, LLC — QUANTITATIVE TRADING DIVISION</Text>
              <View style={styles.titleAccent} />
              <Text style={styles.pageDesc}>
                Built by two students who wanted to bring the trading floor experience online.
              </Text>
            </View>

            {/* Tech stack strip */}
            <FadeInOnScroll scrollY={scrollY}>
              <View style={styles.stackSection}>
                <Text style={styles.stackLabel}>// TECH STACK</Text>
                <View style={styles.stackRow}>
                  {STACK.map((s, i) => (
                    <View key={s.label} style={[styles.stackItem, i < STACK.length - 1 && styles.stackItemBorder]}>
                      <Text style={styles.stackValue}>{s.value}</Text>
                      <Text style={styles.stackKey}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeInOnScroll>

            {/* Team members */}
            {TEAM.map(member => (
              <FadeInOnScroll key={member.id} scrollY={scrollY}>
                <View style={styles.memberSection}>
                  <View style={styles.memberHeader}>
                    <Text style={styles.memberTag}>{member.tag}</Text>
                    <View style={styles.memberTitleBlock}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberMeta}>{member.degree}  ·  {member.school}</Text>
                    </View>
                  </View>

                  {Platform.OS === 'web' && (
                    <Text style={styles.memberBio}>{member.bio}</Text>
                  )}

                  <View style={styles.linksRow}>
                    {member.links.map(link => (
                      <TouchableOpacity
                        key={link.label}
                        style={styles.linkBtn}
                        onPress={() => Linking.openURL(link.url)}
                      >
                        <Ionicons name={link.icon} size={14} color={T.textDim} />
                        <Text style={styles.linkBtnText}>{link.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </FadeInOnScroll>
            ))}

            {/* Footer */}
            <FadeInOnScroll scrollY={scrollY}>
              <View style={styles.footer}>
                <Link href="/" style={styles.backLink}>
                  <Text style={styles.backLinkText}>← BACK TO TERMINAL</Text>
                </Link>
              </View>
            </FadeInOnScroll>

          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  topBarBrand: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
  },
  topBarSection: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.cyan,
    letterSpacing: 2,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  inner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  // Page header
  pageHeader: {
    paddingVertical: 48,
    borderBottomWidth: 1,
    borderColor: T.border,
    marginBottom: 8,
  },
  pageTitle: {
    fontFamily: 'Orbitron',
    fontSize: 32,
    color: T.textPri,
    letterSpacing: 6,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontFamily: 'Orbitron',
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 3,
    marginBottom: 16,
  },
  titleAccent: {
    width: 40,
    height: 2,
    backgroundColor: T.cyan,
    marginBottom: 20,
  },
  pageDesc: {
    fontFamily: T.mono,
    fontSize: 14,
    color: T.textSec,
    lineHeight: 22,
    maxWidth: 560,
  },

  // Tech stack
  stackSection: {
    borderBottomWidth: 1,
    borderColor: T.border,
    paddingVertical: 28,
  },
  stackLabel: {
    fontFamily: T.mono,
    fontSize: 10,
    color: T.textDim,
    letterSpacing: 2,
    marginBottom: 16,
  },
  stackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stackItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  stackItemBorder: {
    borderRightWidth: 1,
    borderColor: T.border,
  },
  stackValue: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textPri,
    marginBottom: 4,
  },
  stackKey: {
    fontFamily: T.mono,
    fontSize: 9,
    color: T.textDim,
    letterSpacing: 2,
  },

  // Member
  memberSection: {
    borderBottomWidth: 1,
    borderColor: T.border,
    paddingVertical: 36,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  memberTag: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1,
    marginTop: 4,
  },
  memberTitleBlock: {
    flex: 1,
  },
  memberName: {
    fontFamily: 'Orbitron',
    fontSize: 20,
    color: T.textPri,
    letterSpacing: 3,
    marginBottom: 6,
  },
  memberMeta: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.cyan,
    letterSpacing: 1,
  },
  memberBio: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.textSec,
    lineHeight: 22,
    marginBottom: 24,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: T.surface,
  },
  linkBtnText: {
    fontFamily: T.mono,
    fontSize: 11,
    color: T.textDim,
    letterSpacing: 1,
  },

  // Footer
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  backLink: {
    paddingVertical: 10,
  },
  backLinkText: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.textDim,
    letterSpacing: 2,
  },
});
