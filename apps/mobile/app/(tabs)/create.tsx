import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Aspect, type Edit, baseKey, defaultEdit, renderEdit } from '../../src/lib/editing';
import { filters } from '../../src/lib/filters';
import { applyPixelFilter, filtersSupported } from '../../src/lib/pixelFilter';
import {
  type PickedMedia,
  maxImageWidth,
  maxPostPhotos,
  pickMedia,
  publishPhotos,
  publishStoryPhoto,
  publishVideo,
} from '../../src/lib/posts';
import { supabase } from '../../src/lib/supabase';
import { CharCount } from '../../src/ui/CharCount';
import { useSession } from '../../src/lib/session';
import { useTheme } from '../../src/theme';
import { Clip } from '../../src/ui/Clip';
import { LibraryGrid, type LibraryPick } from '../../src/ui/LibraryGrid';

type Mode = 'post' | 'story' | 'reel';
type Step = 'select' | 'edit' | 'details';
type Item = PickedMedia & { id: string; libId?: string; edit: Edit; alt?: string };

const modeTitle: Record<Mode, string> = { post: 'New post', story: 'New story', reel: 'New reel' };
const newId = () => Math.random().toString(36).slice(2, 10);

export default function Create() {
  const { colors, spacing } = useTheme();
  const { profile } = useSession();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('post');
  const [step, setStep] = useState<Step>('select');
  const [items, setItems] = useState<Item[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [multiple, setMultiple] = useState(false);
  const [caption, setCaption] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [compare, setCompare] = useState(false);
  const [closeOnly, setCloseOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryDenied, setLibraryDenied] = useState(false);

  const kinds = mode === 'post' ? 'both' : mode === 'reel' ? 'videos' : 'photos';
  const focus = items.find((i) => i.id === focusId) ?? items[0];
  const selected = useMemo(() => new Map(items.flatMap((i, n) => (i.libId ? [[i.libId, n + 1] as const] : []))), [items]);
  const allowMany = mode === 'post' && multiple;

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setItems([]);
    setFocusId(null);
    setMultiple(false);
    setStep('select');
    setError(null);
  }

  function close() {
    setItems([]);
    setCaption('');
    setStep('select');
    router.navigate('/');
  }

  /** Adds one picked item, enforcing: one video or up to ten photos, never mixed. */
  function add(media: PickedMedia, libId?: string) {
    const item: Item = { ...media, id: newId(), libId, edit: defaultEdit };
    setError(null);
    setItems((current) => {
      if (media.kind === 'video' || !allowMany) return [item];
      if (current.some((c) => c.kind === 'video')) return [item];
      if (current.length >= maxPostPhotos) {
        setError(`You can share up to ${maxPostPhotos} photos in one post.`);
        return current;
      }
      return [...current, item];
    });
    setFocusId(item.id);
  }

  function onLibraryTap(pick: LibraryPick) {
    const existing = items.find((i) => i.libId === pick.libId);
    if (!existing) return add(pick, pick.libId);
    if (allowMany && focus?.id !== existing.id) return setFocusId(existing.id);
    setItems((c) => c.filter((i) => i.id !== existing.id));
    setFocusId(null);
  }

  async function browse() {
    const picked = await pickMedia(kinds, allowMany);
    if (picked.length === 0) return;
    if (allowMany && picked.every((p) => p.kind === 'photo')) {
      const next = picked.slice(0, maxPostPhotos).map((p): Item => ({ ...p, id: newId(), edit: defaultEdit }));
      setItems(next);
      setFocusId(next[0]?.id ?? null);
    } else {
      add(picked[0]!);
    }
  }

  function setAlt(id: string, alt: string) {
    setItems((c) => c.map((i) => (i.id === id ? { ...i, alt } : i)));
  }

  function patchEdit(id: string, patch: Partial<Edit>) {
    setItems((c) => c.map((i) => (i.id === id ? { ...i, edit: { ...i.edit, ...patch } } : i)));
  }

  function next() {
    if (items.length === 0) return;
    if (step === 'select') setStep(items[0]!.kind === 'video' ? 'details' : 'edit');
    else if (step === 'edit') setStep('details');
  }

  function back() {
    if (step === 'details') setStep(items[0]?.kind === 'video' ? 'select' : 'edit');
    else if (step === 'edit') setStep('select');
    else close();
  }

  async function share() {
    if (items.length === 0 || !profile) return;
    setBusy(true);
    setError(null);
    try {
      if (items[0]!.kind === 'video') {
        await publishVideo(items[0]!, profile.id, caption, spoiler);
      } else {
        const rendered = [];
        for (const item of items) rendered.push(await renderEdit(item, item.edit, maxImageWidth));
        if (mode === 'story') await publishStoryPhoto(rendered[0]!, profile.id, closeOnly);
        else {
          const postId = await publishPhotos(rendered, profile.id, caption, items.map((i) => i.alt ?? ''), spoiler);
          if (compare && items.length === 2) await supabase.rpc('set_post_compare', { p_post_id: postId, p_on: true });
        }
      }
      const wasVideo = items[0]!.kind === 'video';
      setItems([]);
      setCaption('');
      setSpoiler(false);
      setCompare(false);
      setCloseOnly(false);
      setStep('select');
      router.navigate(wasVideo ? '/reels' : '/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = step === 'edit' ? 'Edit' : step === 'details' ? modeTitle[mode] : modeTitle[mode];
  const nextLabel = step === 'details' ? (mode === 'story' ? 'Share to story' : 'Share') : 'Next';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={step === 'select' ? 'Close' : 'Back'} onPress={back} hitSlop={12} style={{ width: 70 }}>
          <Ionicons name={step === 'select' ? 'close' : 'chevron-back'} size={30} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
        <View style={{ width: 70, alignItems: 'flex-end' }}>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text
              accessibilityRole="button"
              onPress={items.length === 0 ? undefined : step === 'details' ? share : next}
              style={{ color: colors.primary, fontSize: 16, fontWeight: '700', opacity: items.length === 0 ? 0.4 : 1 }}
            >
              {nextLabel}
            </Text>
          )}
        </View>
      </View>

      {step === 'select' ? (
        <View style={{ flex: 1 }}>
          <View style={{ width, height: width, backgroundColor: colors.surface }}>
            {focus ? (
              focus.kind === 'video' ? (
                <Clip key={focus.id} uri={focus.uri} active muted style={{ width, height: width }} />
              ) : (
                <Image source={{ uri: focus.uri }} contentFit="cover" style={{ width, height: width }} accessibilityLabel="Selected photo" />
              )
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="images-outline" size={44} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                  {mode === 'reel' ? 'Choose a video' : mode === 'story' ? 'Choose a photo' : 'Choose photos or a video'}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{Platform.OS === 'web' ? 'Your library' : 'Recents'}</Text>
            {mode === 'post' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: multiple }}
                onPress={() => {
                  setMultiple((m) => !m);
                  setItems((c) => c.slice(0, 1));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: multiple ? colors.primary : colors.surface, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }}
              >
                <Ionicons name="copy-outline" size={16} color={multiple ? '#fff' : colors.text} />
                <Text style={{ color: multiple ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>Select multiple</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Browse files" onPress={browse} style={{ backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{Platform.OS === 'web' ? 'Choose' : 'Browse'}</Text>
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, paddingHorizontal: spacing.md, paddingBottom: 6 }}>
              {error}
            </Text>
          ) : null}
          {Platform.OS === 'web' || libraryDenied ? (
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
              {items.map((item, n) => {
                const size = Math.floor((width - 3) / 4);
                return (
                  <Pressable key={item.id} accessibilityRole="button" onPress={() => setFocusId(item.id)} style={{ width: size, height: size, backgroundColor: colors.surface }}>
                    {item.kind === 'photo' ? <Image source={{ uri: item.uri }} contentFit="cover" style={{ width: size, height: size }} /> : <Ionicons name="play" size={22} color={colors.text} style={{ margin: 'auto' }} />}
                    {items.length > 1 ? (
                      <View style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{n + 1}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add from library"
                onPress={browse}
                style={{ width: Math.floor((width - 3) / 4), height: Math.floor((width - 3) / 4), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="add" size={30} color={colors.textMuted} />
              </Pressable>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <LibraryGrid kinds={kinds} selected={selected} multiple={allowMany} onTap={onLibraryTap} onDenied={() => setLibraryDenied(true)} />
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
            {(['post', 'story', 'reel'] as const).map((m) => (
              <Text
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => reset(m)}
                style={{ color: mode === m ? colors.text : colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }}
              >
                {m.toUpperCase()}
              </Text>
            ))}
          </View>
        </View>
      ) : step === 'edit' && focus ? (
        <Editor items={items} focus={focus} onFocus={setFocusId} onPatch={patchEdit} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            {focus ? <DetailThumb item={focus} count={items.length} /> : null}
            {mode !== 'story' ? (
              <TextInput
                accessibilityLabel="Caption"
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption… use #hashtags and @mentions"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2200}
                style={{ flex: 1, minHeight: 88, color: colors.text, fontSize: 16, textAlignVertical: 'top', outlineStyle: 'none' } as never}
              />
            ) : (
              <Text style={{ flex: 1, color: colors.textMuted, fontSize: 14 }}>Your story disappears after 24 hours.</Text>
            )}
          </View>
          {mode === 'story' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="star" size={22} color="#22A559" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>Close friends only</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Only people on your close friends list can see it.</Text>
              </View>
              <Switch accessibilityLabel="Close friends only" value={closeOnly} onValueChange={setCloseOnly} />
            </View>
          ) : null}
          {mode !== 'story' ? <CharCount value={caption} max={2200} /> : null}
          {mode !== 'story' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Mark as spoiler</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>People tap to reveal it. Use it for results, plot twists and surprises.</Text>
              </View>
              <Switch accessibilityLabel="Mark as spoiler" value={spoiler} onValueChange={setSpoiler} />
            </View>
          ) : null}
          {mode === 'post' && items.length === 2 && items[0]?.kind !== 'video' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Before and after</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>People drag a slider to compare your two photos. The first is the before.</Text>
              </View>
              <Switch accessibilityLabel="Before and after" value={compare} onValueChange={setCompare} />
            </View>
          ) : null}
          {mode === 'post' && items[0]?.kind !== 'video' ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Alt text</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Describe your {items.length > 1 ? 'photos' : 'photo'} for people who use screen readers.
              </Text>
              {items.map((item, n) => (
                <TextInput
                  key={item.id}
                  accessibilityLabel={items.length > 1 ? `Alt text for photo ${n + 1}` : 'Alt text'}
                  value={item.alt ?? ''}
                  onChangeText={(t) => setAlt(item.id, t)}
                  placeholder={items.length > 1 ? `Describe photo ${n + 1}` : 'Write alt text…'}
                  placeholderTextColor={colors.textMuted}
                  maxLength={1000}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 15, outlineStyle: 'none' } as never}
                />
              ))}
            </View>
          ) : null}
          {busy ? <Text style={{ color: colors.textMuted }}>{items[0]?.kind === 'video' ? 'Uploading video. This can take a moment…' : 'Sharing…'}</Text> : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14 }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailThumb({ item, count }: { item: Item; count: number }) {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(item.kind === 'photo' ? item.uri : null);
  useEffect(() => {
    if (item.kind !== 'photo') return;
    let live = true;
    renderEdit(item, item.edit, 240).then((r) => live && setUri(r.uri));
    return () => {
      live = false;
    };
  }, [item]);
  return (
    <View style={{ width: 88, height: 88, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={{ width: 88, height: 88 }} /> : <Ionicons name="play" size={26} color={colors.text} />}
      {count > 1 ? (
        <View style={{ position: 'absolute', top: 4, right: 4 }}>
          <Ionicons name="copy" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

function Editor({ items, focus, onFocus, onPatch }: { items: Item[]; focus: Item; onFocus: (id: string) => void; onPatch: (id: string, patch: Partial<Edit>) => void }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'filters' | 'edit'>(filtersSupported ? 'filters' : 'edit');
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const ticket = useRef(0);

  // Main preview: re-render whenever this photo or its edits change.
  useEffect(() => {
    const mine = ++ticket.current;
    setWorking(true);
    renderEdit(focus, focus.edit, 1080)
      .then((r) => {
        if (mine === ticket.current) setPreview(r.uri);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mine === ticket.current) setWorking(false);
      });
  }, [focus]);

  // Filter strip: one small base render, then each filter applied to it.
  const key = `${focus.id}|${baseKey(focus.edit)}`;
  useEffect(() => {
    if (!filtersSupported || tab !== 'filters') return;
    let live = true;
    setThumbs({});
    void (async () => {
      const base = await renderEdit(focus, { ...focus.edit, filter: 'normal' }, 150);
      for (const f of filters) {
        const out = await applyPixelFilter(base, f.id);
        if (!live) return;
        setThumbs((t) => ({ ...t, [f.id]: out.uri }));
      }
    })().catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tab]);

  const aspects: [Aspect, string][] = [['original', 'Original'], ['1:1', 'Square'], ['4:5', 'Portrait']];
  const tool = { alignItems: 'center', gap: 6, minWidth: 72 } as const;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ width, height: width, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        {preview ? <Image source={{ uri: preview }} contentFit="contain" style={{ width, height: width }} accessibilityLabel="Photo preview" /> : null}
        {working ? (
          <View style={{ position: 'absolute' }}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : null}
      </View>
      {items.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, padding: spacing.sm }}>
          {items.map((i, n) => (
            <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={`Photo ${n + 1}`} onPress={() => onFocus(i.id)}>
              <Image source={{ uri: i.uri }} contentFit="cover" style={{ width: 52, height: 52, borderRadius: 4, borderWidth: i.id === focus.id ? 2 : 0, borderColor: colors.primary }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }}>
        {([['filters', 'Filters'], ['edit', 'Edit']] as const)
          .filter(([k]) => k === 'edit' || filtersSupported)
          .map(([k, label]) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              onPress={() => setTab(k)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: tab === k ? colors.text : 'transparent', marginBottom: -1 }}
            >
              <Text style={{ color: tab === k ? colors.text : colors.textMuted, fontWeight: '700', fontSize: 14 }}>{label}</Text>
            </Pressable>
          ))}
      </View>
      {tab === 'filters' && filtersSupported ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, padding: spacing.md }}>
          {filters.map((f) => (
            <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: focus.edit.filter === f.id }} onPress={() => onPatch(focus.id, { filter: f.id })} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 82, height: 82, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 2, borderColor: focus.edit.filter === f.id ? colors.primary : 'transparent' }}>
                {thumbs[f.id] ? <Image source={{ uri: thumbs[f.id] }} contentFit="cover" style={{ width: '100%', height: '100%' }} /> : null}
              </View>
              <Text style={{ color: focus.edit.filter === f.id ? colors.text : colors.textMuted, fontSize: 12, fontWeight: focus.edit.filter === f.id ? '700' : '400' }}>{f.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Rotate" onPress={() => onPatch(focus.id, { rotate: (((focus.edit.rotate + 90) % 360) as Edit['rotate']) })} style={tool}>
              <Ionicons name="refresh-outline" size={26} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 12 }}>Rotate</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Flip" onPress={() => onPatch(focus.id, { flipped: !focus.edit.flipped })} style={tool}>
              <Ionicons name="swap-horizontal-outline" size={26} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 12 }}>Flip</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            {aspects.map(([a, label]) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityState={{ selected: focus.edit.aspect === a }}
                onPress={() => onPatch(focus.id, { aspect: a })}
                style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: focus.edit.aspect === a ? colors.text : colors.surface }}
              >
                <Text style={{ color: focus.edit.aspect === a ? colors.background : colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
