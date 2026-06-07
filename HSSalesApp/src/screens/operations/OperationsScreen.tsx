import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as usersApi from '../../api/users';
import * as catalogApi from '../../api/catalog';
import { MeshBackground } from '../../components/ui/MeshBackground';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { useT } from '../../i18n/useT';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSalesDataset } from '../../store/slices/salesDataSlice';
import { palette, radii } from '../../theme/designSystem';
import { useTabScreenBottomPadding } from '../../navigation/tabBarMetrics';
import { showToast } from '../../store/slices/uiSlice';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Collapsible section card ───────────────────────────────────────────────────

function Section({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={sc.wrap}>
      <Pressable onPress={onToggle} style={({ pressed }) => [sc.header, pressed && { opacity: 0.82 }]}>
        <Text style={sc.icon}>{icon}</Text>
        <Text style={sc.title}>{title}</Text>
        <Text style={sc.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && <View style={sc.body}>{children}</View>}
    </View>
  );
}
const sc = StyleSheet.create({
  wrap: {
    backgroundColor: palette.cardBg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.cardBgElevated,
  },
  icon: { fontSize: 18 },
  title: { color: palette.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2, flex: 1 },
  chevron: { color: palette.emerald, fontSize: 16, fontWeight: '900' },
  body: { borderTopWidth: 1, borderTopColor: palette.cardBorder },
});

// ── Item row (view / edit / delete) ───────────────────────────────────────────

function ItemRow({
  label,
  subLabel,
  isEditing,
  editSlot,
  onEdit,
  onDelete,
  busy,
}: {
  label: string;
  subLabel?: string;
  isEditing: boolean;
  editSlot: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  if (isEditing) {
    return <View style={ir.editWrap}>{editSlot}</View>;
  }
  return (
    <View style={ir.row}>
      <View style={{ flex: 1 }}>
        <Text style={ir.label} numberOfLines={1}>{label}</Text>
        {!!subLabel && <Text style={ir.sub} numberOfLines={1}>{subLabel}</Text>}
      </View>
      <Pressable onPress={onEdit} style={ir.iconBtn} hitSlop={8}>
        <Text style={ir.editIcon}>✎</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={ir.iconBtn} hitSlop={8}>
        <Text style={ir.deleteIcon}>🗑</Text>
      </Pressable>
    </View>
  );
}
const ir = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: palette.cardBorder,
  },
  label: { color: palette.text, fontSize: 14, fontWeight: '700' },
  sub: { color: palette.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  iconBtn: { padding: 6, marginLeft: 4 },
  editIcon: { fontSize: 15, color: palette.emerald },
  deleteIcon: { fontSize: 14 },
  editWrap: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
});

// ── Inline edit panel ──────────────────────────────────────────────────────────

function EditPanel({
  children,
  onSave,
  onCancel,
  busy,
  saveLabel = 'Save',
}: {
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  saveLabel?: string;
}) {
  return (
    <View style={ep.wrap}>
      {children}
      <View style={ep.actions}>
        <Pressable onPress={onCancel} style={ep.cancelBtn}>
          <Text style={ep.cancelText}>✕</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={busy} style={ep.saveBtn}>
          {busy ? <ActivityIndicator color={palette.onAccent} size="small" /> : <Text style={ep.saveText}>{saveLabel}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
const ep = StyleSheet.create({
  wrap: { gap: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.md, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.cardBgElevated },
  cancelText: { color: palette.textMuted, fontSize: 13, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.md, backgroundColor: palette.emerald, minWidth: 70, alignItems: 'center', shadowColor: palette.emerald, shadowOpacity: 0.40, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  saveText: { color: palette.onAccent, fontSize: 13, fontWeight: '900' },
});

// ── Add row ────────────────────────────────────────────────────────────────────

function AddRow({ children, onAdd, busy }: { children: React.ReactNode; onAdd: () => void; busy: boolean }) {
  return (
    <View style={ar.row}>
      <View style={{ flex: 1, gap: 8 }}>{children}</View>
      <Pressable
        onPress={onAdd}
        disabled={busy}
        style={({ pressed }) => [ar.addBtn, busy && ar.addBtnDisabled, pressed && { opacity: 0.82 }]}>
        {busy ? <ActivityIndicator color={palette.onAccent} size="small" /> : <Text style={ar.addBtnText}>+</Text>}
      </Pressable>
    </View>
  );
}
const ar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 14 },
  addBtn: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: palette.emerald, alignItems: 'center', justifyContent: 'center', flexShrink: 0, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addBtnDisabled: { opacity: 0.40, shadowOpacity: 0 },
  addBtnText: { color: palette.onAccent, fontSize: 22, fontWeight: '900', lineHeight: 26 },
});

// ── Shared input style ──────────────────────────────────────────────────────────

const inp = StyleSheet.create({
  field: { color: palette.text, fontSize: 14, fontWeight: '700', borderWidth: 1, borderColor: palette.stroke, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.inputInset },
  label: { color: palette.textLabel, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

type SectionKey = 'products' | 'units' | 'currencies' | 'warehouses' | 'users';

export function OperationsScreen() {
  const t = useT();
  const dispatch = useAppDispatch();
  const tabBottomPad = useTabScreenBottomPadding();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const locale = useAppSelector((s) => s.ui.locale);
  const { units, currencies, warehouses, products } = useAppSelector((s) => s.salesData);

  // All sections start collapsed
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    products: false,
    units: false,
    currencies: false,
    warehouses: false,
    users: false,
  });

  function toggle(key: SectionKey) {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnitId, setEditUnitId] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const startEdit = (id: string, name: string, unitId = '') => { setEditingId(id); setEditName(name); setEditUnitId(unitId); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditUnitId(''); };

  // New product draft
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnitId, setNewProductUnitId] = useState('');

  // New simple item drafts
  const [newUnit, setNewUnit] = useState('');
  const [newCurrency, setNewCurrency] = useState('');
  const [newWarehouse, setNewWarehouse] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  // User form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userBusy, setUserBusy] = useState(false);

  const nameErr = !newName.trim() ? t('operations.errNameRequired') : null;
  const emailErr = !newEmail.trim() ? t('operations.errEmailRequired') : !newEmail.includes('@') ? t('operations.errEmailInvalid') : null;
  const pwErr = !newPassword ? t('operations.errPasswordRequired') : newPassword.length < 6 ? t('operations.errPasswordShort') : null;
  const cfmErr = newPassword !== confirmPassword ? t('operations.errConfirmMismatch') : null;
  const canAddUser = role === 'admin' && !!token && !nameErr && !emailErr && !pwErr && !cfmErr && !userBusy;

  const unitOptions = useMemo(() => units.map((u) => ({ value: u.id, label: u.label })), [units]);

  async function refresh() { dispatch(fetchSalesDataset()); }

  function confirm(msg: string, onOk: () => Promise<void>) {
    Alert.alert(locale === 'bn' ? 'নিশ্চিত করুন' : 'Confirm', msg, [
      { text: locale === 'bn' ? 'বাতিল' : 'Cancel', style: 'cancel' },
      { text: locale === 'bn' ? 'মুছুন' : 'Delete', style: 'destructive', onPress: onOk },
    ]);
  }

  // ── Products ──────────────────────────────────────────────────────────────

  async function addProduct() {
    if (!token || !newProductName.trim() || !newProductUnitId) return;
    setAddBusy(true);
    try {
      await catalogApi.createProduct(newProductName.trim(), newProductUnitId, token);
      setNewProductName(''); setNewProductUnitId('');
      await refresh();
      dispatch(showToast({ title: locale === 'bn' ? 'পণ্য যোগ হয়েছে' : 'Product Added', message: newProductName, type: 'success' }));
    } catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setAddBusy(false); }
  }

  async function saveProduct(id: string) {
    if (!token || !editName.trim() || !editUnitId) return;
    setEditBusy(true);
    try {
      await catalogApi.updateProduct(id, editName.trim(), editUnitId, token);
      await refresh(); cancelEdit();
    } catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setEditBusy(false); }
  }

  async function deleteProduct(id: string, name: string) {
    confirm(name, async () => {
      if (!token) return;
      await catalogApi.deleteProduct(id, token);
      await refresh();
    });
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  async function addUnit() {
    if (!token || !newUnit.trim()) return;
    setAddBusy(true);
    try { await catalogApi.createUnit({ label: newUnit.trim() }, token); setNewUnit(''); await refresh(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setAddBusy(false); }
  }

  async function saveUnit(id: string) {
    if (!token || !editName.trim()) return;
    setEditBusy(true);
    try { await catalogApi.updateUnit(id, editName.trim(), token); await refresh(); cancelEdit(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setEditBusy(false); }
  }

  async function deleteUnit(id: string, label: string) {
    confirm(label, async () => { if (!token) return; await catalogApi.deleteUnit(id, token); await refresh(); });
  }

  // ── Currencies ────────────────────────────────────────────────────────────

  async function addCurrency() {
    if (!token || !newCurrency.trim()) return;
    setAddBusy(true);
    try { await catalogApi.createCurrency({ code: newCurrency.trim() }, token); setNewCurrency(''); await refresh(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setAddBusy(false); }
  }

  async function saveCurrency(id: string) {
    if (!token || !editName.trim()) return;
    setEditBusy(true);
    try { await catalogApi.updateCurrency(id, editName.trim(), token); await refresh(); cancelEdit(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setEditBusy(false); }
  }

  async function deleteCurrency(id: string, code: string) {
    confirm(code, async () => { if (!token) return; await catalogApi.deleteCurrency(id, token); await refresh(); });
  }

  // ── Warehouses ────────────────────────────────────────────────────────────

  async function addWarehouse() {
    if (!token || !newWarehouse.trim()) return;
    setAddBusy(true);
    try { await catalogApi.createWarehouse(newWarehouse.trim(), token); setNewWarehouse(''); await refresh(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setAddBusy(false); }
  }

  async function saveWarehouse(id: string) {
    if (!token || !editName.trim()) return;
    setEditBusy(true);
    try { await catalogApi.updateWarehouse(id, editName.trim(), token); await refresh(); cancelEdit(); }
    catch (e: any) { Alert.alert('Error', e?.message); }
    finally { setEditBusy(false); }
  }

  async function deleteWarehouse(id: string, name: string) {
    confirm(name, async () => { if (!token) return; await catalogApi.deleteWarehouse(id, token); await refresh(); });
  }

  // ── Add User ──────────────────────────────────────────────────────────────

  async function addUser() {
    if (!canAddUser || !token) return;
    setUserBusy(true);
    try {
      const res = await usersApi.createSalesUser({ name: newName.trim(), phone: newPhone.trim() || undefined, email: newEmail.trim(), password: newPassword }, token);
      dispatch(showToast({ title: t('operations.toastUserAddedTitle'), message: t('operations.toastUserAddedMsg', { email: res.user.email }), type: 'success' }));
      setNewName(''); setNewPhone(''); setNewEmail(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      dispatch(showToast({ title: t('operations.toastUserFailTitle'), message: e?.message || t('operations.toastUserFailMsg'), type: 'error' }));
    } finally { setUserBusy(false); }
  }

  if (role !== 'admin') {
    return (
      <MeshBackground>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScreenHeader title={t('operations.title')} />
          <View style={styles.center}><Text style={styles.muted}>{t('operations.adminOnly')}</Text></View>
        </SafeAreaView>
      </MeshBackground>
    );
  }

  const lbl = (text: string) => <Text style={inp.label}>{text}</Text>;
  const field = (value: string, onChange: (v: string) => void, ph: string, opts?: object) => (
    <TextInput value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor={palette.textMuted} style={inp.field} {...opts} />
  );

  return (
    <MeshBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={t('operations.title')} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBottomPad + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Products ── */}
            <Section title={locale === 'bn' ? 'পণ্য' : 'Products'} icon="📦" expanded={expanded.products} onToggle={() => toggle('products')}>
              {products.map((p) => {
                const uLabel = units.find((u) => u.id === p.unitId)?.label ?? p.unitId;
                return (
                  <ItemRow
                    key={p.id}
                    label={p.name}
                    subLabel={uLabel}
                    isEditing={editingId === p.id}
                    onEdit={() => startEdit(p.id, p.name, p.unitId)}
                    onDelete={() => deleteProduct(p.id, p.name)}
                    busy={editBusy}
                    editSlot={
                      <EditPanel onSave={() => saveProduct(p.id)} onCancel={cancelEdit} busy={editBusy} saveLabel={locale === 'bn' ? 'সংরক্ষণ' : 'Save'}>
                        {lbl(locale === 'bn' ? 'নাম' : 'Name')}
                        {field(editName, setEditName, p.name)}
                        <SelectMenu label={locale === 'bn' ? 'একক' : 'Unit'} value={editUnitId} options={unitOptions} onChange={setEditUnitId} />
                      </EditPanel>
                    }
                  />
                );
              })}
              <AddRow onAdd={addProduct} busy={addBusy}>
                {lbl(locale === 'bn' ? 'পণ্যের নাম' : 'Product name')}
                {field(newProductName, setNewProductName, locale === 'bn' ? 'যেমন: শরিষা, চাল' : 'e.g. Mustard, Rice')}
                <SelectMenu label={locale === 'bn' ? 'একক বেছে নিন' : 'Select unit'} value={newProductUnitId} options={unitOptions} onChange={setNewProductUnitId} />
              </AddRow>
            </Section>

            {/* ── Units ── */}
            <Section title={locale === 'bn' ? 'একক' : 'Units'} icon="⚖️" expanded={expanded.units} onToggle={() => toggle('units')}>
              {units.map((u) => (
                <ItemRow key={u.id} label={u.label} isEditing={editingId === u.id} onEdit={() => startEdit(u.id, u.label)} onDelete={() => deleteUnit(u.id, u.label)} busy={editBusy}
                  editSlot={<EditPanel onSave={() => saveUnit(u.id)} onCancel={cancelEdit} busy={editBusy} saveLabel={locale === 'bn' ? 'সংরক্ষণ' : 'Save'}>
                    {lbl(locale === 'bn' ? 'লেবেল' : 'Label')}{field(editName, setEditName, u.label)}
                  </EditPanel>} />
              ))}
              <AddRow onAdd={addUnit} busy={addBusy}>
                {lbl(locale === 'bn' ? 'নতুন একক' : 'New unit')}
                {field(newUnit, setNewUnit, 'KG, LITER, BOSTA…')}
              </AddRow>
            </Section>

            {/* ── Currencies ── */}
            <Section title={locale === 'bn' ? 'মুদ্রা' : 'Currencies'} icon="💱" expanded={expanded.currencies} onToggle={() => toggle('currencies')}>
              {currencies.map((c) => (
                <ItemRow key={c.id} label={c.code} isEditing={editingId === c.id} onEdit={() => startEdit(c.id, c.code)} onDelete={() => deleteCurrency(c.id, c.code)} busy={editBusy}
                  editSlot={<EditPanel onSave={() => saveCurrency(c.id)} onCancel={cancelEdit} busy={editBusy} saveLabel={locale === 'bn' ? 'সংরক্ষণ' : 'Save'}>
                    {lbl(locale === 'bn' ? 'কোড' : 'Code')}{field(editName, setEditName, c.code, { autoCapitalize: 'characters' })}
                  </EditPanel>} />
              ))}
              <AddRow onAdd={addCurrency} busy={addBusy}>
                {lbl(locale === 'bn' ? 'মুদ্রা কোড' : 'Currency code')}
                {field(newCurrency, setNewCurrency, 'BDT, USD…', { autoCapitalize: 'characters' })}
              </AddRow>
            </Section>

            {/* ── Warehouses ── */}
            <Section title={locale === 'bn' ? 'গুদাম' : 'Warehouses'} icon="🏭" expanded={expanded.warehouses} onToggle={() => toggle('warehouses')}>
              {warehouses.map((w) => (
                <ItemRow key={w.id} label={w.name} isEditing={editingId === w.id} onEdit={() => startEdit(w.id, w.name)} onDelete={() => deleteWarehouse(w.id, w.name)} busy={editBusy}
                  editSlot={<EditPanel onSave={() => saveWarehouse(w.id)} onCancel={cancelEdit} busy={editBusy} saveLabel={locale === 'bn' ? 'সংরক্ষণ' : 'Save'}>
                    {lbl(locale === 'bn' ? 'নাম' : 'Name')}{field(editName, setEditName, w.name)}
                  </EditPanel>} />
              ))}
              <AddRow onAdd={addWarehouse} busy={addBusy}>
                {lbl(locale === 'bn' ? 'গুদামের নাম' : 'Warehouse name')}
                {field(newWarehouse, setNewWarehouse, locale === 'bn' ? 'যেমন: মূল গুদাম' : 'e.g. Main Store')}
              </AddRow>
            </Section>

            {/* ── Add Sales User ── */}
            <Section title={t('operations.newUserTitle')} icon="👤" expanded={expanded.users} onToggle={() => toggle('users')}>
              <View style={styles.userForm}>
                <Text style={styles.label}>{t('operations.name')}</Text>
                <TextInput value={newName} onChangeText={setNewName} placeholder={t('operations.namePh')} placeholderTextColor={palette.textMuted} style={[styles.input, nameErr && styles.inputError]} editable={!userBusy} />
                {!!nameErr && <Text style={styles.fieldError}>{nameErr}</Text>}

                <Text style={[styles.label, { marginTop: 14 }]}>{t('operations.phone')}</Text>
                <TextInput value={newPhone} onChangeText={setNewPhone} placeholder={t('operations.phonePh')} placeholderTextColor={palette.textMuted} keyboardType="phone-pad" style={styles.input} editable={!userBusy} />

                <Text style={[styles.label, { marginTop: 14 }]}>{t('operations.email')}</Text>
                <TextInput value={newEmail} onChangeText={setNewEmail} placeholder={t('operations.emailPh')} placeholderTextColor={palette.textMuted} autoCapitalize="none" keyboardType="email-address" style={[styles.input, emailErr && styles.inputError]} editable={!userBusy} />
                {!!emailErr && <Text style={styles.fieldError}>{emailErr}</Text>}

                <Text style={[styles.label, { marginTop: 14 }]}>{t('operations.password')}</Text>
                <View style={styles.inputRow}>
                  <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('operations.passwordPh')} placeholderTextColor={palette.textMuted} secureTextEntry={!showPassword} style={[styles.input, styles.inputInRow, pwErr && styles.inputError]} editable={!userBusy} />
                  <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10} style={styles.toggle}>
                    <Text style={styles.toggleText}>{showPassword ? t('login.hide') : t('login.show')}</Text>
                  </Pressable>
                </View>
                {!!pwErr && <Text style={styles.fieldError}>{pwErr}</Text>}

                <Text style={[styles.label, { marginTop: 14 }]}>{t('operations.confirm')}</Text>
                <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('operations.confirmPh')} placeholderTextColor={palette.textMuted} secureTextEntry={!showPassword} style={[styles.input, cfmErr && styles.inputError]} editable={!userBusy} />
                {!!cfmErr && <Text style={styles.fieldError}>{cfmErr}</Text>}

                <Pressable onPress={addUser} disabled={!canAddUser} style={({ pressed }) => [styles.primary, !canAddUser && styles.primaryDisabled, pressed && canAddUser && styles.primaryPressed]}>
                  {userBusy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={styles.primaryText}>{t('operations.addUser')}</Text>}
                </Pressable>
              </View>
            </Section>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MeshBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 12, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: palette.textMuted, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  userForm: { padding: 16, gap: 0 },
  label: { color: palette.textLabel, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14 },
  input: { marginTop: 8, borderRadius: radii.md, borderWidth: 1, borderColor: palette.stroke, paddingHorizontal: 14, paddingVertical: Platform.select({ ios: 13, android: 11, default: 11 }), color: palette.text, backgroundColor: palette.inputInset, fontWeight: '600', fontSize: 15 },
  inputInRow: { flex: 1, marginTop: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  inputError: { borderColor: palette.danger },
  fieldError: { marginTop: 5, color: palette.danger, fontSize: 12, fontWeight: '700' },
  toggle: { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 4 },
  toggleText: { color: palette.emerald, fontWeight: '800', fontSize: 13 },
  primary: { marginTop: 18, borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center', backgroundColor: palette.emerald, shadowColor: palette.emerald, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  primaryDisabled: { opacity: 0.45, shadowOpacity: 0 },
  primaryPressed: { backgroundColor: palette.emeraldDeep },
  primaryText: { color: palette.onAccent, fontWeight: '900', fontSize: 15 },
});
