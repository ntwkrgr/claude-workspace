/* Learning-page runtime: saved progress plus free-answer grading.
   Paste inside the page's <script> before page code. Publish with
   capabilities {db: {rules: [{path: "progress", read: "view", write: "owner"}]}, user: {}, sample: {}}.

   Progress lives in one document, progress/main:
   { lessons: { <stationId>: { questions: { <qid>: { tries, verdict, answer, feedback, at } } } },
     note, updated }
   verdict is "right", "partly" or "not_yet"; answer is the learner's last answer, trimmed. */
const Learn = (() => {
  let state = { lessons: {}, note: '' };   // the saved record, mirrored in memory
  let store = null, sample = null;         // db document and grader, null when unavailable
  let canWrite = false, saveTimer = null, writing = Promise.resolve();
  const changeFns = [];                    // callbacks run whenever state changes
  let statusFn = () => {};                 // shows a one-line save status

  // Runs every change callback with the current state
  const changed = () => changeFns.forEach(fn => fn(state));

  // Debounces writes and sends one at a time to the progress document
  function queueSave() {
    if (!canWrite) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      statusFn('Saving…');
      const body = JSON.parse(JSON.stringify({ ...state, updated: new Date().toISOString() }));
      writing = writing.then(() => store.set(body))
        .then(() => statusFn('Progress saved.'), () => statusFn('Couldn’t save. Answers stay until you reload.'));
    }, 500);
  }

  // Connects to the store and grader; resolves once both are known
  async function connect(onStatus) {
    statusFn = onStatus || statusFn;
    const use = globalThis.claude?.use;
    if (!use) { statusFn('Progress isn’t saved in this view.'); return; }
    const [db, user, grader] = await Promise.all([use('db'), use('user'), use('sample')]);
    sample = grader;
    const owner = (await user?.isOwner?.()) ?? false;
    if (!db) { statusFn('Progress isn’t saved in this view.'); return; }
    store = db.doc('progress/main');
    const timer = setTimeout(() => statusFn('Saved progress can’t be reached yet.'), 10000);
    let first = true;
    // Subscribes once; adopts the stored record unless this page has a write in flight
    store.onSnapshot(snap => {
      if (!snap.metadata.fromCache) clearTimeout(timer);
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.exists ? snap.data() : null;
      if (data) { state = { lessons: JSON.parse(JSON.stringify(data.lessons || {})), note: data.note || '' }; changed(); }
      if (first) {
        first = false; canWrite = owner;
        statusFn(owner ? (data ? 'Progress saved.' : 'Progress saves as you answer.') : 'Viewing someone else’s progress. Your answers aren’t saved.');
      }
    }, () => { clearTimeout(timer); statusFn('Saved progress isn’t available right now.'); });
  }

  // Returns the saved record for one question, or undefined
  const get = (station, qid) => state.lessons[station]?.questions?.[qid];

  // Stores a graded attempt and queues a save
  function record(station, qid, { verdict, answer, feedback }) {
    const lesson = state.lessons[station] = { questions: {}, ...(state.lessons[station] || {}) };
    lesson.questions = { ...lesson.questions };
    const prev = lesson.questions[qid] || { tries: 0 };
    lesson.questions[qid] = { tries: prev.tries + 1, verdict, answer: String(answer).slice(0, 600),
      feedback: String(feedback || '').slice(0, 400), at: new Date().toISOString() };
    changed(); queueSave();
  }

  // Saves the learner's free-form note
  function setNote(text) { state.note = String(text).slice(0, 4000); changed(); queueSave(); }

  // True when every listed question in a station has a "right" verdict
  const stationDone = (station, qids) => qids.every(q => get(station, q)?.verdict === 'right');

  // Grades one free answer against a rubric; resolves {verdict, feedback} or null when grading is unavailable
  async function grade({ question, rubric, answer }) {
    if (!sample) return null;
    const prompt = 'You grade one short answer on a learning page. Be fair and brief: credit correct ideas in plain words, '
      + 'do not require exact terms, and do not penalize spelling.\n\n'
      + `Question: ${question}\nWhat a right answer contains: ${rubric}\nLearner's answer: ${answer}\n\n`
      + 'Reply with only JSON: {"verdict": "right" | "partly" | "not_yet", "feedback": "one or two sentences: what was right, '
      + 'and the one idea missing or wrong, without giving the full answer away unless the verdict is right"}';
    try {
      const out = await sample.json(prompt, { modelTier: 'quick' });
      const verdict = ['right', 'partly', 'not_yet'].includes(out?.verdict) ? out.verdict : null;
      return verdict ? { verdict, feedback: String(out.feedback || '') } : null;
    } catch (e) {
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) sample = null;
      return null;
    }
  }

  // Builds one free-answer question inside el and keeps it in sync with saved progress.
  // spec: {station, qid, question, rubric, model}; model is the answer shown after two misses or when grading is off.
  // Markup classes for the page to style: .q .q-prompt .q-input .q-actions .q-verdict(.right|.partly|.not_yet) .q-model
  function mountQuestion(el, spec) {
    const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const id = `q-${spec.station}-${spec.qid}`;
    const prompt = make('label', 'q-prompt', spec.question); prompt.htmlFor = id;
    const input = make('textarea', 'q-input'); input.id = id; input.rows = 3; input.placeholder = 'Answer in your own words';
    const check = make('button', 'btn solid', 'Check'); check.type = 'button';
    const reveal = make('button', 'btn', 'Show an answer'); reveal.type = 'button'; reveal.hidden = true;
    const actions = make('div', 'q-actions'); actions.append(check, reveal);
    const verdict = make('p', 'q-verdict'); verdict.hidden = true; verdict.setAttribute('role', 'status');
    const model = make('div', 'q-model'); model.hidden = true;
    const box = make('div', 'q'); box.append(prompt, input, actions, verdict, model); el.append(box);
    const words = { right: 'Right.', partly: 'Partly.', not_yet: 'Not yet.' };

    // Shows the model answer with self-grade buttons (used when grading is off or after two misses)
    function showModel(selfGrade) {
      model.replaceChildren(make('p', null, spec.model));
      if (selfGrade) {
        const got = make('button', 'btn', 'I had that'); got.type = 'button';
        const not = make('button', 'btn', 'I missed it'); not.type = 'button';
        got.onclick = () => record(spec.station, spec.qid, { verdict: 'right', answer: input.value, feedback: 'self-graded' });
        not.onclick = () => record(spec.station, spec.qid, { verdict: 'not_yet', answer: input.value, feedback: 'self-graded' });
        const row = make('div', 'q-actions'); row.append(got, not); model.append(row);
      }
      model.hidden = false;
    }
    // Reflects the saved attempt for this question
    function render() {
      const rec = get(spec.station, spec.qid);
      if (rec && document.activeElement !== input && !input.value) input.value = rec.answer || '';
      if (rec) { verdict.textContent = `${words[rec.verdict] || ''} ${rec.feedback === 'self-graded' ? '' : rec.feedback}`.trim(); verdict.className = `q-verdict ${rec.verdict}`; verdict.hidden = false; }
      const done = rec?.verdict === 'right';
      input.disabled = check.disabled = done;
      reveal.hidden = done || !rec || rec.tries < 2;
    }
    check.onclick = async () => {
      const answer = input.value.trim();
      if (!answer) { input.focus(); return; }
      check.disabled = true; verdict.hidden = false; verdict.className = 'q-verdict'; verdict.textContent = 'Checking…';
      const result = await grade({ question: spec.question, rubric: spec.rubric, answer });
      check.disabled = false;
      if (!result) { verdict.textContent = 'Grading isn’t available here. Compare with this answer:'; showModel(true); return; }
      record(spec.station, spec.qid, { ...result, answer });
    };
    reveal.onclick = () => showModel(false);
    changeFns.push(render); render();
  }

  return { connect, get, record, setNote, stationDone, grade, mountQuestion,
    onChange: fn => { changeFns.push(fn); fn(state); },
    state: () => state, canGrade: () => !!sample };
})();
