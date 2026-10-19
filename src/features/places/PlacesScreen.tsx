import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import {
  Badge,
  Button,
  ChoiceChips,
  confirm,
  EmptyState,
  Field,
  Form,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  Page,
  Section,
  SheetActions,
  Switch,
  TextField,
} from '@/ui';
import { places, routes, type Place, type Route } from './model';

function setHome(id: string): void {
  for (const p of places.all.value) if (p.isHome && p.id !== id) places.update(p.id, { isHome: false });
  places.update(id, { isHome: true });
}

function PlaceForm({ place, close }: { place: Place | null; close: () => void }) {
  const [name, setName] = useState(place?.name ?? '');
  const [isHome, setIsHome] = useState(place?.isHome ?? places.all.value.length === 0);

  const save = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = place ? (places.update(place.id, { name: trimmed }), place.id) : places.add({ name: trimmed, isHome: false }).id;
    if (isHome) setHome(id);
    else if (place?.isHome) places.update(id, { isHome: false });
    haptic('success');
    close();
  };

  const remove = async (): Promise<void> => {
    if (!place) return;
    const ok = await confirm({ title: `Удалить «${place.name}»?`, message: 'Дорога до этого места тоже удалится.', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    for (const r of routes.all.value) if (r.fromId === place.id || r.toId === place.id) routes.remove(r.id);
    places.remove(place.id);
    close();
  };

  return (
    <Form>
      <TextField label="Название" value={name} onValue={setName} placeholder="Дом, Корпус 2, Зал…" autoFocus={!place} />
      <List>
        <ListRow title="Это дом" subtitle="День начинается и заканчивается здесь" trailing={<Switch label="Дом" checked={isHome} onChange={setIsHome} />} />
      </List>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          Сохранить
        </Button>
        {place && (
          <Button variant="danger" block icon="trash" onClick={() => void remove()}>
            Удалить место
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

function RouteForm({ route, close }: { route: Route | null; close: () => void }) {
  const all = places.all.value;
  const [fromId, setFrom] = useState<string | null>(route?.fromId ?? all.find((p) => p.isHome)?.id ?? null);
  const [toId, setTo] = useState<string | null>(route?.toId ?? null);
  const [minutes, setMinutes] = useState(route?.minutes ?? 30);
  const [bothWays, setBothWays] = useState(route?.bothWays ?? true);
  const options = all.map((p) => ({ value: p.id, label: p.name }));
  const valid = fromId !== null && toId !== null && fromId !== toId;

  const save = (): void => {
    if (!valid) return;
    const data = { fromId, toId, minutes, bothWays };
    if (route) routes.update(route.id, data);
    else {
      // One route per direction pair: replace an existing one instead of duplicating.
      const existing = routes.all.value.find((r) => r.fromId === fromId && r.toId === toId);
      if (existing) routes.update(existing.id, data);
      else routes.add(data);
    }
    haptic('success');
    close();
  };

  return (
    <Form>
      <Field label="Откуда">
        <ChoiceChips options={options} value={fromId} onChange={setFrom} />
      </Field>
      <Field label="Куда">
        <ChoiceChips options={options.filter((o) => o.value !== fromId)} value={toId} onChange={setTo} />
      </Field>
      <NumberStepper label="В пути" value={minutes} step={5} min={0} max={300} unit="мин" onChange={setMinutes} />
      <List>
        <ListRow title="Столько же обратно" trailing={<Switch label="Обратно" checked={bothWays} onChange={setBothWays} />} />
      </List>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!valid} feedback={false} onClick={save}>
          Сохранить
        </Button>
        {route && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={() => {
              routes.remove(route.id);
              close();
            }}
          >
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

const openPlace = (place: Place | null): void => {
  openSheet((close) => <PlaceForm place={place} close={close} />, { title: place ? 'Место' : 'Новое место' });
};
const openRoute = (route: Route | null): void => {
  openSheet((close) => <RouteForm route={route} close={close} />, { title: route ? 'Дорога' : 'Новая дорога' });
};

export function PlacesScreen() {
  const all = places.all.value;
  const allRoutes = routes.all.value;
  const name = (id: string): string => places.get(id)?.name ?? '—';

  return (
    <Page title="Места и дорога" back>
      <Section title="Места" action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openPlace(null)}>Добавить</Button>}>
        {all.length === 0 ? (
          <EmptyState icon="pin" title="Мест пока нет" text="Добавь дом, корпуса, зал, работу — и время в пути между ними." />
        ) : (
          <List>
            {all.map((p) => (
              <ListRow key={p.id} icon="pin" title={p.name} trailing={p.isHome ? <Badge tone="accent">Дом</Badge> : undefined} chevron onClick={() => openPlace(p)} />
            ))}
          </List>
        )}
      </Section>

      {all.length >= 2 && (
        <Section title="Время в пути" action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openRoute(null)}>Добавить</Button>}>
          {allRoutes.length === 0 ? (
            <EmptyState icon="navigation" title="Дорога не указана" text="Без неё свободное время считается без учёта пути." />
          ) : (
            <List>
              {allRoutes.map((r) => (
                <ListRow
                  key={r.id}
                  icon="navigation"
                  title={`${name(r.fromId)} ${r.bothWays ? '↔' : '→'} ${name(r.toId)}`}
                  value={`${r.minutes} мин`}
                  chevron
                  onClick={() => openRoute(r)}
                />
              ))}
            </List>
          )}
        </Section>
      )}
    </Page>
  );
}
