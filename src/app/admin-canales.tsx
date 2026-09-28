import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { BackButton } from '@/components/mape/back-button';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/types';

const TYPES: { value: 'OPERACIONES' | 'ZONA' | 'TALLER'; label: string }[] = [
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'ZONA', label: 'Zona' },
  { value: 'TALLER', label: 'Taller' },
];

export default function AdminCanalesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('OPERACIONES');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const channelsQuery = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<Channel[]>('/radio/channels'),
  });
  const channels = channelsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/radio/channels', {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
      setName('');
      setDescription('');
      setType('OPERACIONES');
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el canal'),
  });

  const canSave = name.trim().length > 0 && !createMutation.isPending;

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      <Animated.View style={styles.header} entering={fade(0)}>
        <BackButton />
        <Text style={styles.title}>Canales de radio</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 16 }}
        keyboardShouldPersistTaps="handled">
        {/* Formulario nuevo canal */}
        <Animated.View style={styles.card} entering={rise(1)}>
          <Text style={styles.cardTitle}>Nuevo canal</Text>

          <Text style={styles.label}>Nombre</Text>
          <View style={styles.inputWrap}>
            <Icon name="radio" size={18} color="#6A6A6A" strokeWidth={1.8} />
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder='Ej. "Canal 1"'
              placeholderTextColor="#9A9A9A"
            />
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.segment}>
            {TYPES.map((t) => {
              const on = t.value === type;
              return (
                <PressableScale
                  key={t.value}
                  style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                  onPress={() => setType(t.value)}>
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={styles.label}>Descripción (opcional)</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              placeholder='Ej. "Norte"'
              placeholderTextColor="#9A9A9A"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <PressableScale
            style={[styles.primary, !canSave && styles.primaryDisabled]}
            onPress={() => canSave && createMutation.mutate()}>
            {createMutation.isPending ? (
              <ActivityIndicator color={Mape.white} />
            ) : (
              <>
                <Icon name="plus" size={18} color={Mape.white} strokeWidth={2.2} />
                <Text style={styles.primaryText}>Crear canal</Text>
              </>
            )}
          </PressableScale>
        </Animated.View>

        {/* Lista de canales existentes */}
        <Animated.View style={styles.card} entering={rise(2)}>
          <Text style={styles.cardTitle}>
            Canales existentes {channels.length ? `· ${channels.length}` : ''}
          </Text>
          {channelsQuery.isLoading ? (
            <ActivityIndicator color={Mape.ink} style={{ marginVertical: 16 }} />
          ) : channels.length === 0 ? (
            <Text style={styles.empty}>Aún no hay canales. Crea el primero arriba.</Text>
          ) : (
            channels.map((c) => (
              <View key={c.id} style={styles.channelRow}>
                <View style={styles.channelIcon}>
                  <Icon name="radio" size={18} color={Mape.ink} strokeWidth={1.8} />
                </View>
                <View style={styles.channelInfo}>
                  <Text style={styles.channelName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.channelMeta} numberOfLines={1}>
                    {c.description ? `${c.description} · ` : ''}
                    {c.type} · {c.memberCount} miembro{c.memberCount === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontFamily: Font.semibold, color: Mape.ink },

  card: { backgroundColor: Mape.white, borderRadius: 22, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontFamily: Font.semibold, color: Mape.ink, marginBottom: 2 },
  label: { fontSize: 13, fontFamily: Font.semibold, color: '#4A4A4A', marginTop: 4 },

  inputWrap: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Mape.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, color: Mape.ink, fontFamily: Font.regular, padding: 0 },

  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnOn: { backgroundColor: Mape.ink },
  segmentText: { fontSize: 13, fontFamily: Font.semibold, color: '#6A6A6A' },
  segmentTextOn: { color: Mape.white },

  error: { color: Mape.red, fontSize: 13, fontFamily: Font.regular },

  primary: {
    marginTop: 6,
    height: 54,
    borderRadius: 27,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: Mape.white, fontSize: 15, fontFamily: Font.semibold },
  primaryDisabled: { opacity: 0.5 },

  empty: {
    fontSize: 13,
    color: Mape.textFaint,
    fontFamily: Font.regular,
    textAlign: 'center',
    paddingVertical: 16,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: { flex: 1, gap: 2, minWidth: 0 },
  channelName: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  channelMeta: { fontSize: 12, fontFamily: Font.regular, color: Mape.textMuted },
});
