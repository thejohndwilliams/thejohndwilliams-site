// @vitest-environment happy-dom
// Foundation-proof interaction test (throwaway branch, 2026-07-30).
// HARD EVIDENCE for the framework evaluation gate: mounts the Vue SFC,
// asserts Quasar components render as real elements, and proves reactive
// state by driving a click and asserting the rendered output changes.
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Quasar } from 'quasar';
import FoundationProof from '../src/components/FoundationProof.vue';

describe('FoundationProof: Vue reactivity + Quasar rendering inside this repo', () => {
  it('renders Quasar QBtn as a real button element with Quasar classes', () => {
    const w = mount(FoundationProof, { global: { plugins: [[Quasar, {}]] } });
    const btn = w.find('button.q-btn');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Reset (a QBtn)');
    expect(w.find('.q-toggle').exists()).toBe(true);
  });

  it('reactive filter: clicking a category chip changes the rendered list', async () => {
    const w = mount(FoundationProof, { global: { plugins: [[Quasar, {}]] } });
    expect(w.find('.fp-count').text()).toContain('3 frames in sky');
    const chips = w.findAll('.fp-chip');
    const water = chips.find(c => c.text() === 'water');
    await water!.trigger('click');
    expect(w.find('.fp-count').text()).toContain('2 frames in water');
    expect(w.findAll('.fp-list li').map(li => li.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('dscf1928')])
    );
  });

  it('reactive toggle: register-strict prunes p50 > 60 frames', async () => {
    const w = mount(FoundationProof, { global: { plugins: [[Quasar, {}]] } });
    const chips = w.findAll('.fp-chip');
    await chips.find(c => c.text() === 'structure')!.trigger('click');
    expect(w.find('.fp-count').text()).toContain('2 frames in structure');
    await w.find('.q-toggle').trigger('click');
    expect(w.find('.fp-count').text()).toContain('1 frames in structure');
  });
});
