import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Appbar, Avatar, Button, Card, Dialog, FAB, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: any;
}

interface Measurement {
  id: string;
  mode: string;
  dimensions: {
    width: string;
    height: string;
    extra: string;
  };
  label: string;
  date: string;
  projectId?: string;
}

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { user, isGuest, loading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalVisible, setIsProjectModalVisible] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      router.replace('/login');
    }
  }, [loading, user, isGuest]);

  useEffect(() => {
    if (!user) return;

    // Fetch Projects
    const projectsRef = collection(db, `users/${user.uid}/projects`);
    const projectsQuery = query(projectsRef);

    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);
      setFetching(false);
    });

    // Fetch Measurements (Recent ones)
    const measurementsRef = collection(db, `users/${user.uid}/measurements`);
    const measurementsQuery = query(measurementsRef);

    const unsubscribeMeasurements = onSnapshot(measurementsQuery, (snapshot) => {
      const measurementsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Measurement[];
      setMeasurements(measurementsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubscribeProjects();
      unsubscribeMeasurements();
    };
  }, [user]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      if (!user) return;
      await addDoc(collection(db, `users/${user.uid}/projects`), {
        name: newProjectName,
        createdAt: serverTimestamp(),
        description: 'New Project'
      });
      setNewProjectName('');
      setIsProjectModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleExportProject = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const projectMeasurements = measurements.filter(m => m.projectId === selectedProjectId);

    if (projectMeasurements.length === 0) {
      Alert.alert("No Data", "This project has no measurements to export.");
      return;
    }

    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; }
              .header { border-bottom: 2px solid #6200ee; padding-bottom: 20px; margin-bottom: 40px; }
              .project-title { font-size: 32px; font-weight: bold; color: #000; }
              .project-meta { color: #666; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { text-align: left; padding: 12px; background-color: #f3f4f6; border-bottom: 2px solid #6200ee; }
              td { padding: 12px; border-bottom: 1px solid #eee; }
              .mode-pill { background: #6200ee; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
              .footer { margin-top: 50px; text-align: center; color: #999; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="project-title">Project: ${project.name}</div>
              <div class="project-meta">Summary Report Generated on ${new Date().toLocaleString()}</div>
              <div>${projectMeasurements.length} measurements found</div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Label / Mode</th>
                  <th>Dimensions</th>
                  <th>Analysis</th>
                </tr>
              </thead>
              <tbody>
                ${projectMeasurements.map(m => `
                  <tr>
                    <td style="font-size: 12px;">${new Date(m.date).toLocaleDateString()}</td>
                    <td>
                      <div style="font-weight: bold;">${m.label || 'Unnamed'}</div>
                      <span class="mode-pill">${m.mode.toUpperCase()}</span>
                    </td>
                    <td>
                      <div>W: ${m.dimensions.width}</div>
                      <div>H: ${m.dimensions.height}</div>
                    </td>
                    <td style="font-weight: bold; color: #6200ee;">${m.dimensions.extra || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              Generated by SnapMeasure Pro - Advanced AR Measuring Solutions
              <br>© ${new Date().getFullYear()} SnapMeasure AI
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Export ${project.name}`, UTI: 'com.adobe.pdf' });
    } catch (e: any) {
      Alert.alert("Export Failed", e.message);
    }
  };

  if (loading || (!user && !isGuest)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const filteredMeasurements = selectedProjectId
    ? measurements.filter(m => m.projectId === selectedProjectId)
    : measurements;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <LinearGradient
        colors={[theme.colors.primaryContainer, 'transparent']}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ overflow: 'hidden' }}>
        <BlurView intensity={80} tint="light">
          <Appbar.Header mode="center-aligned" style={{ backgroundColor: 'transparent' }} elevated={false}>
            <Appbar.Content title="SnapMeasure AI" titleStyle={{ fontWeight: '900', letterSpacing: 1 }} />
            <Appbar.Action icon="information-outline" onPress={() => router.push('/help' as any)} />
          </Appbar.Header>
        </BlurView>
      </View>

      <ScrollView className="flex-1">
        {/* Projects Section */}
        <View className="p-4 pb-0">
          <View className="flex-row justify-between items-center mb-4">
            <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Projects</Text>
            <View style={{ flexDirection: 'row' }}>
              {selectedProjectId && (
                <Button compact icon="share-variant" onPress={handleExportProject}>Report</Button>
              )}
              <Button compact onPress={() => setIsProjectModalVisible(true)}>+ New</Button>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <Animated.View layout={Layout} style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => setSelectedProjectId(null)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: selectedProjectId === null ? theme.colors.primary : 'rgba(255,255,255,0.7)',
                  marginRight: 10,
                  height: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.05)'
                }}
              >
                <Text style={{ color: selectedProjectId === null ? 'white' : theme.colors.onSurface, fontWeight: 'bold' }}>All</Text>
              </TouchableOpacity>
              {projects.map((project, index) => (
                <Animated.View key={project.id} entering={FadeInRight.delay(index * 100)}>
                  <TouchableOpacity
                    onPress={() => setSelectedProjectId(project.id)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: selectedProjectId === project.id ? theme.colors.primary : 'rgba(255,255,255,0.7)',
                      marginRight: 10,
                      height: 40,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.05)'
                    }}
                  >
                    <Text style={{ color: selectedProjectId === project.id ? 'white' : theme.colors.onSurface, fontWeight: '600' }}>{project.name}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          </ScrollView>
        </View>

        {/* Measurements List */}
        <View className="p-4">
          <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6 }}>
            {selectedProjectId ? 'Project Data' : 'Recent Scans'}
          </Text>

          {filteredMeasurements.length === 0 ? (
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={{ alignItems: 'center', justifyContent: 'center', marginTop: height * 0.05 }}
            >
              <Avatar.Icon
                size={80}
                icon="cube-scan"
                style={{ backgroundColor: theme.colors.elevation.level2, marginBottom: 16 }}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>No Measurements Found</Text>
              <Text variant="bodySmall" style={{ textAlign: 'center', marginTop: 8, opacity: 0.6, maxWidth: '80%' }}>
                {selectedProjectId ? "This project doesn't have any items yet." : "Tap the camera to start measuring."}
              </Text>
            </Animated.View>
          ) : (
            filteredMeasurements.map((item, index) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(index * 50).springify()} layout={Layout}>
                <Card style={{ marginBottom: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.8)' }} onPress={() => { }}>
                  <Card.Title
                    title={item.label || item.mode.toUpperCase()}
                    subtitle={new Date(item.date).toLocaleDateString()}
                    left={(props) => (
                      <View style={{ backgroundColor: theme.colors.primaryContainer, borderRadius: 12, padding: 4 }}>
                        <Avatar.Icon {...props} icon={item.mode === 'volume' ? 'cube-scan' : 'ruler-square'} size={32} style={{ backgroundColor: 'transparent' }} color={theme.colors.primary} />
                      </View>
                    )}
                    right={(props) => (
                      <View style={{ marginRight: 16, alignItems: 'flex-end' }}>
                        <Text variant="titleLarge" style={{ fontWeight: '900', color: theme.colors.primary }}>{item.dimensions.width}</Text>
                        {item.dimensions.height !== '0 cm' && <Text variant="labelSmall" style={{ opacity: 0.6 }}>× {item.dimensions.height}</Text>}
                      </View>
                    )}
                  />
                </Card>
              </Animated.View>
            ))
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Portal>
        <Dialog visible={isProjectModalVisible} onDismiss={() => setIsProjectModalVisible(false)}>
          <Dialog.Title>Create New Project</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Project Name"
              value={newProjectName}
              onChangeText={setNewProjectName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsProjectModalVisible(false)}>Cancel</Button>
            <Button onPress={handleCreateProject}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB
        icon="plus"
        label="Start Scanning"
        color="white"
        style={{
          position: 'absolute',
          margin: 16,
          alignSelf: 'center',
          bottom: 20,
          backgroundColor: theme.colors.primary,
          borderRadius: 28,
        }}
        onPress={() => router.push({
          pathname: '/measure',
          params: { projectId: selectedProjectId || '' }
        })}
      />
    </View>
  );
}
