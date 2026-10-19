import { ChoiceChips } from '@/ui';
import { places } from './model';

/** Choose a place or "none". */
export function PlacePicker({ value, onChange, noneLabel = 'Не указано' }: { value: string | null; onChange: (id: string | null) => void; noneLabel?: string }) {
  const options = [{ value: '', label: noneLabel }, ...places.all.value.map((p) => ({ value: p.id, label: p.name }))];
  return <ChoiceChips options={options} value={value ?? ''} onChange={(v) => onChange(v ? v : null)} />;
}
