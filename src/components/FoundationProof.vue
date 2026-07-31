<template>
  <section class="fp">
    <p class="fp-eyebrow">foundation proof</p>
    <h3 class="fp-title">A Vue 3 island, running Quasar, inside the Astro shell</h3>
    <p class="fp-note">
      This widget is a Vue single-file component with reactive state, mounted as
      an island on this Astro page. The two controls below are genuine Quasar
      components (QBtn, QToggle) from quasar@{{ quasarVersion }}. Nothing else
      on this site paid a byte for it: every other page still ships zero
      framework JavaScript.
    </p>

    <div class="fp-row">
      <button
        v-for="c in cats"
        :key="c"
        class="fp-chip"
        :class="{ lit: c === active }"
        @click="active = c"
      >{{ c }}</button>
    </div>

    <p class="fp-count">
      {{ filtered.length }} frames in <span class="fp-cat">{{ active }}</span>
      <span v-if="strict"> · register-strict (p50 ≤ 60)</span>
    </p>

    <ul class="fp-list">
      <li v-for="f in filtered" :key="f.file">
        <span class="fp-file">{{ f.file }}</span>
        <span class="fp-p50">p50 {{ f.p50 }}</span>
      </li>
    </ul>

    <div class="fp-quasar">
      <q-toggle v-model="strict" dense color="grey-5" label="Register-strict" />
      <q-btn
        outline
        no-caps
        color="grey-4"
        label="Reset (a QBtn)"
        @click="active = 'sky'; strict = false"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { version as quasarVersion } from 'quasar/package.json';
import 'quasar/dist/quasar.prod.css';

// A miniature of the real curation data: category filtering with reactive
// state - the class of future feature (dynamic galleries) a reactive island
// would serve. Data inline so the proof stays self-contained.
const frames = [
  { file: '7r52268', cat: 'sky', p50: 1 },
  { file: '7r52314', cat: 'sky', p50: 21 },
  { file: 'img-1066', cat: 'sky', p50: 31 },
  { file: '7r51024', cat: 'earth', p50: 12 },
  { file: 'dscf0783', cat: 'earth', p50: 18 },
  { file: 'dscf1928', cat: 'water', p50: 24 },
  { file: 'dscf1941', cat: 'water', p50: 8 },
  { file: 'gv-1fd48bd9', cat: 'structure', p50: 9 },
  { file: 'dscf0580', cat: 'structure', p50: 66 },
];
const cats = ['sky', 'earth', 'water', 'structure'];
const active = ref('sky');
const strict = ref(false);
const filtered = computed(() =>
  frames.filter(f => f.cat === active.value && (!strict.value || f.p50 <= 60))
);
</script>

<style scoped>
/* House register, scoped to this island - Vue SFC scoping and Astro
   component scoping are the same mechanism; neither leaks. */
.fp { max-width: 42rem; }
.fp-eyebrow { font-size: 0.667rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(244,234,222,0.5); margin-bottom: 0.75rem; }
.fp-title { font-family: 'EB Garamond Variable', Georgia, serif; font-size: 1.35rem; color: #F4EADE; margin-bottom: 0.75rem; }
.fp-note { font-size: 0.85rem; line-height: 1.6; color: rgba(244,234,222,0.6); margin-bottom: 1.25rem; }
.fp-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.fp-chip { padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: rgba(20,21,25,0.5); color: rgba(244,234,222,0.65); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
.fp-chip.lit { border-color: rgba(244,234,222,0.5); color: #F4EADE; background: rgba(244,234,222,0.08); }
.fp-count { font-size: 0.8rem; color: rgba(244,234,222,0.55); margin-bottom: 0.75rem; }
.fp-cat { color: #F4EADE; }
.fp-list { list-style: none; padding: 0; margin: 0 0 1.5rem; }
.fp-list li { display: flex; justify-content: space-between; padding: 0.45rem 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem; color: rgba(244,234,222,0.7); }
.fp-p50 { color: rgba(244,234,222,0.4); }
.fp-quasar { display: flex; align-items: center; gap: 1.25rem; }
</style>
