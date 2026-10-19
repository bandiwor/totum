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
import { t } from '@/core/i18n';

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
    const ok = await confirm({ title: t('schedule.deleteNamed', { name: place.name }), message: t('places.deletePlaceText'), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    for (const r of routes.all.value) if (r.fromId === place.id || r.toId === place.id) routes.remove(r.id);
    places.remove(place.id);
    close();
  };

  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} placeholder={t('places.namePlaceholder')} autoFocus={!place} />
      <List>
        <ListRow title={t('places.isHome')} subtitle={t('places.isHomeHint')} trailing={<Switch label={t('places.home')} checked={isHome} onChange={setIsHome} />} />
      </List>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {place && (
          <Button variant="danger" block icon="trash" onClick={() => void remove()}>
            {t('places.deletePlace')}
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
      <Field label={t('places.from')}>
        <ChoiceChips options={options} value={fromId} onChange={setFrom} />
      </Field>
      <Field label={t('places.to')}>
        <ChoiceChips options={options.filter((o) => o.value !== fromId)} value={toId} onChange={setTo} />
      </Field>
      <NumberStepper label={t('places.onTheWay')} value={minutes} step={5} min={0} max={300} unit={t('units.min')} onChange={setMinutes} />
      <List>
        <ListRow title={t('places.sameBack')} trailing={<Switch label={t('places.back')} checked={bothWays} onChange={setBothWays} />} />
      </List>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!valid} feedback={false} onClick={save}>
          {t('common.save')}
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
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

const openPlace = (place: Place | null): void => {
  openSheet((close) => <PlaceForm place={place} close={close} />, { title: place ? t('places.place') : t('places.newPlace') });
};
const openRoute = (route: Route | null): void => {
  openSheet((close) => <RouteForm route={route} close={close} />, { title: route ? t('places.route') : t('places.newRoute') });
};

export function PlacesScreen() {
  const all = places.all.value;
  const allRoutes = routes.all.value;
  const name = (id: string): string => places.get(id)?.name ?? '—';

  return (
    <Page title={t('places.title')} back>
      <Section title={t('places.places')} action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openPlace(null)}>{t('common.add')}</Button>}>
        {all.length === 0 ? (
          <EmptyState icon="pin" title={t('places.noPlaces')} text={t('places.noPlacesText')} />
        ) : (
          <List>
            {all.map((p) => (
              <ListRow key={p.id} icon="pin" title={p.name} trailing={p.isHome ? <Badge tone="accent">{t('places.home')}</Badge> : undefined} chevron onClick={() => openPlace(p)} />
            ))}
          </List>
        )}
      </Section>

      {all.length >= 2 && (
        <Section title={t('places.travelTime')} action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openRoute(null)}>{t('common.add')}</Button>}>
          {allRoutes.length === 0 ? (
            <EmptyState icon="navigation" title={t('places.noRoutes')} text={t('places.noRoutesText')} />
          ) : (
            <List>
              {allRoutes.map((r) => (
                <ListRow
                  key={r.id}
                  icon="navigation"
                  title={t('places.routeTitle', { from: name(r.fromId), arrow: r.bothWays ? '↔' : '→', to: name(r.toId) })}
                  value={t('places.minutes', { n: r.minutes })}
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
