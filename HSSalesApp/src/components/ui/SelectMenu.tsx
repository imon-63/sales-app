import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, radii } from '../../theme/designSystem';

export type SelectOption = { value: string; label: string };

type SelectMenuProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  addNewLabel?: string;
  onAddNew?: (text: string) => Promise<void> | void;
  disabled?: boolean;
};

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  addNewLabel,
  onAddNew,
  disabled,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? placeholder;

  const closeAll = useCallback(() => {
    setOpen(false);
    setAddOpen(false);
    setAddText('');
  }, []);

  const onConfirmAdd = useCallback(async () => {
    const t = addText.trim();
    if (!t || !onAddNew) return;
    try {
      setBusy(true);
      await onAddNew(t);
      closeAll();
    } finally {
      setBusy(false);
    }
  }, [addText, onAddNew, closeAll]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          disabled ? styles.triggerDisabled : null,
          pressed && !disabled ? styles.triggerPressed : null,
        ]}>
        <Text
          style={[
            styles.triggerText,
            value ? styles.triggerTextValue : styles.triggerTextMuted,
          ]}
          numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={styles.chev}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.row,
                    item.value === value ? styles.rowOn : null,
                  ]}>
                  <Text
                    style={[
                      styles.rowText,
                      item.value === value ? styles.rowTextOn : null,
                    ]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            {onAddNew && addNewLabel ? (
              <Pressable
                onPress={() => {
                  setOpen(false);
                  setAddOpen(true);
                }}
                style={styles.addRow}>
                <Text style={styles.addText}>{addNewLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => !busy && setAddOpen(false)}>
          <Pressable style={styles.addSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{addNewLabel}</Text>
            <TextInput
              value={addText}
              onChangeText={setAddText}
              placeholder="Type here"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              style={styles.addInput}
              editable={!busy}
            />
            <View style={styles.addActions}>
              <Pressable
                onPress={() => !busy && setAddOpen(false)}
                style={styles.ghost}>
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmAdd}
                disabled={busy || !addText.trim()}
                style={[
                  styles.primaryMini,
                  (!addText.trim() || busy) && styles.primaryMiniOff,
                ]}>
                <Text style={styles.primaryMiniText}>
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  fieldLabel: {
    marginTop: 14,
    color: palette.textLabel,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  trigger: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.inputInset,
  },
  triggerDisabled: { opacity: 0.45 },
  triggerPressed: { opacity: 0.85 },
  triggerText: { flex: 1, fontWeight: '700', fontSize: 16 },
  triggerTextValue: { color: palette.text },
  triggerTextMuted: { color: palette.textMuted },
  chev: { color: palette.textMuted, fontSize: 14, marginLeft: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: palette.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 24,
    paddingTop: 12,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
  },
  list: { maxHeight: 360 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.stroke,
  },
  rowOn: { backgroundColor: palette.chipSelectedFill },
  rowText: { fontSize: 16, fontWeight: '700', color: palette.text },
  rowTextOn: { fontWeight: '800', color: palette.emerald },
  addRow: { paddingVertical: 14, paddingHorizontal: 20 },
  addText: { color: palette.emerald, fontWeight: '900', fontSize: 15 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: palette.textMuted, fontWeight: '800' },
  addSheet: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: radii.lg,
    backgroundColor: palette.paper,
    padding: 18,
  },
  addInput: {
    marginTop: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontWeight: '600',
    backgroundColor: palette.inputInset,
  },
  addActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  ghost: { paddingVertical: 10, paddingHorizontal: 12 },
  ghostText: { color: palette.textMuted, fontWeight: '800' },
  primaryMini: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: palette.emerald,
  },
  primaryMiniOff: { opacity: 0.45 },
  primaryMiniText: { color: palette.onAccent, fontWeight: '900' },
});
