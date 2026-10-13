
(() => {
  'use strict';
  const DATA = JSON.parse(document.getElementById('quiz-data').textContent);
  const QUESTIONS = DATA.questions;
  const DOMAINS = DATA.domains;
  const TOTAL = QUESTIONS.length;
  const STORAGE_KEY = 'engineering-mindset-v1';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  const pad = (value) => String(value).padStart(2, '0');
  const optionLetter = (question, optionId) => String.fromCharCode(65 + question.options.findIndex((option) => option.id === optionId));
  const icons = [
    '<path d="M3 8h7v7H3zM14 3h7v7h-7zM14 15h7v6h-7zM10 11.5h4M17.5 10v5"/>',
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>',
    '<path d="M9 18h6M9.5 21h5M8.5 15.5c-.1-2-3-2.9-3-6a6.5 6.5 0 0 1 13 0c0 3.1-2.9 4-3 6h-7Z"/><path d="m10 10 2-2 2 2-2 3"/>',
    '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="19" r="2"/><path d="M5 8v4h14V8M12 12v5"/>',
    '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6M7.5 10l1.7 1.7 3.3-3.4"/>'
  ];
  const icon = (index) => `<svg class="dimension-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg>`;
  let storageAvailable = true;
  let state;
  let activeView = 'welcome';
  let result = null;
  let reviewFilter = 'all';
  let toastTimer;
  let dialogAction = null;

  function emptyState() {
    return {version: DATA.version, answers: {}, cursor: 0, startedAt: null, finishedAt: null, updatedAt: null};
  }
  function validDate(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
  }
  function loadState() {
    const clean = emptyState();
    try {
      const probe = `${STORAGE_KEY}-probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clean;
      const stored = JSON.parse(raw);
      if (!stored || stored.version !== DATA.version || !stored.answers || typeof stored.answers !== 'object') return clean;
      for (const question of QUESTIONS) {
        const selected = stored.answers[question.id];
        if (question.options.some((option) => option.id === selected)) clean.answers[question.id] = selected;
      }
      if (Number.isInteger(stored.cursor)) clean.cursor = Math.max(0, Math.min(TOTAL - 1, stored.cursor));
      clean.startedAt = validDate(stored.startedAt);
      clean.updatedAt = validDate(stored.updatedAt);
      clean.finishedAt = Object.keys(clean.answers).length === TOTAL ? validDate(stored.finishedAt) : null;
      return clean;
    } catch (error) {
      // Corrupt stored JSON is recoverable. A denied storage API should not block the quiz.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {
        storageAvailable = false;
      }
      return clean;
    }
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    if (!storageAvailable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      storageAvailable = false;
      updateStorageNotice();
      return false;
    }
  }
  function updateStorageNotice() {
    $('storage-warning').hidden = storageAvailable;
    $('sidebar-storage').innerHTML = storageAvailable
      ? '每次选择都会自动保存。<br>不确定时，也请选择最接近的一项。'
      : '本地存储当前不可用。<br>请保持页面开启，完成后保存结果。';
    if (!storageAvailable) $('save-status').textContent = '当前页面内保留进度';
  }
  function countAnswered() { return Object.keys(state.answers).length; }
  function announce(message) { $('live-status').textContent = message; }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
  }
  function showView(view, scroll = true) {
    activeView = view;
    for (const name of ['welcome', 'test', 'result']) {
      const element = $(`${name}-view`);
      element.hidden = name !== view;
      element.classList.toggle('view-enter', name === view);
    }
    document.body.classList.toggle('is-testing', view === 'test');
    if (view === 'welcome') updateWelcome();
    $('header-status').textContent = view === 'test'
      ? '本地作答 · 不限时'
      : view === 'result' ? '测试完成 · 结果仅供自我探索' : '50 道题 · 5 个维度';
    if (scroll) window.scrollTo({top: 0, behavior: 'instant'});
  }
  function updateWelcome() {
    const count = countAnswered();
    $('start-button').innerHTML = count === TOTAL
      ? '查看我的结果 <span aria-hidden="true">↗</span>'
      : count > 0 ? `继续作答 · ${count} / ${TOTAL} <span aria-hidden="true">↗</span>`
      : '开始探索 <span aria-hidden="true">↗</span>';
    $('welcome-reset').hidden = count === 0;
    $('welcome-reset').textContent = count === TOTAL ? '重新测试' : '重新开始';
    updateStorageNotice();
  }
  function buildIntro() {
    $('intro-dimensions').innerHTML = DOMAINS.map((domain, index) => `
      <article class="dimension-tile"><div class="dimension-tile-top"><span class="mono">0${index + 1} / 10 Qs</span>${icon(index)}</div>
      <h3>${esc(domain.name)}</h3><div class="tag">${esc(domain.tag)}</div><p>${esc(domain.description)}</p></article>`).join('');
  }
  function makeQuestionNav() {
    return QUESTIONS.map((question, index) => {
      const answered = Boolean(state.answers[question.id]);
      const current = index === state.cursor;
      const domain = DOMAINS.find((item) => item.id === question.domain);
      return `<button class="nav-dot${answered ? ' answered' : ''}${current ? ' current' : ''}" data-question-index="${index}" ${current ? 'aria-current="step"' : ''} aria-label="第 ${index + 1} 题，${esc(domain.name)}，${answered ? '已答' : '未答'}${current ? '，当前题' : ''}">${pad(index + 1)}</button>`;
    }).join('');
  }
  function updateProgress() {
    const count = countAnswered();
    $('answered-count').textContent = count;
    $('mobile-answered').textContent = `${count} / ${TOTAL}`;
    for (const type of ['desktop', 'mobile']) {
      $(`${type}-progress-fill`).style.width = `${count / TOTAL * 100}%`;
      $(`${type}-progress`).setAttribute('aria-valuenow', count);
    }
    $('sidebar-domains').innerHTML = DOMAINS.map((domain) => {
      const done = QUESTIONS.filter((question) => question.domain === domain.id && state.answers[question.id]).length;
      return `<div class="sidebar-domain${QUESTIONS[state.cursor].domain === domain.id ? ' current' : ''}"><span>${esc(domain.name)}</span><span class="domain-count">${done} / 10</span></div>`;
    }).join('');
    $('question-nav').innerHTML = makeQuestionNav();
    const dialogNav = $('dialog-question-nav');
    if (dialogNav) dialogNav.innerHTML = makeQuestionNav();
    updateControls();
  }
  function updateControls() {
    const question = QUESTIONS[state.cursor];
    const count = countAnswered();
    $('prev-button').disabled = state.cursor === 0;
    $('next-button').disabled = !state.answers[question.id];
    $('next-button').innerHTML = count === TOTAL
      ? '查看我的结果 <span aria-hidden="true">↗</span>'
      : state.cursor === TOTAL - 1
        ? `补答剩余 ${TOTAL - count} 题 <span aria-hidden="true">→</span>`
        : '下一题 <span aria-hidden="true">→</span>';
    $('skip-button').hidden = Boolean(state.answers[question.id]);
  }
  function renderQuestion(focus = true) {
    const question = QUESTIONS[state.cursor];
    const domain = DOMAINS.find((item) => item.id === question.domain);
    $('question-category').textContent = domain.name;
    $('question-number').textContent = `${pad(state.cursor + 1)} / ${TOTAL}`;
    $('question-scene').textContent = question.scene;
    $('question-title').textContent = question.stem;
    $('question-instruction').textContent = question.domain === 'logic'
      ? '这是一道推理题。只依据题面信息，选择成立的一项。'
      : '选择你最可能采取的行动，而不是理想中“应该”的答案。';
    $('options').innerHTML = '<legend class="sr-only">选择一个答案</legend>' + question.options.map((option, index) => {
      const selected = state.answers[question.id] === option.id;
      return `<label class="option${selected ? ' selected' : ''}">
        <input class="sr-only" type="radio" name="question-answer" value="${esc(option.id)}" ${selected ? 'checked' : ''}>
        <span class="option-key" aria-hidden="true">${String.fromCharCode(65 + index)}</span>
        <span class="option-text">${esc(option.text)}</span><span class="option-check" aria-hidden="true"></span>
      </label>`;
    }).join('');
    $('save-status').textContent = storageAvailable
      ? state.answers[question.id] ? '本题选择已保存' : '选择后自动保存'
      : '当前页面内保留进度';
    updateProgress();
    announce(`第 ${state.cursor + 1} 题，共 ${TOTAL} 题。${domain.name}。${question.scene}。`);
    if (focus) {
      window.scrollTo({top: 0, behavior: 'instant'});
      $('question-title').focus({preventScroll: true});
    }
  }
  function selectOption(optionId) {
    const question = QUESTIONS[state.cursor];
    if (!question.options.some((option) => option.id === optionId)) return;
    if (state.answers[question.id] !== optionId) state.finishedAt = null;
    state.answers[question.id] = optionId;
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    const saved = persist();
    for (const input of $('options').querySelectorAll('input[type="radio"]')) {
      input.checked = input.value === optionId;
      input.closest('.option').classList.toggle('selected', input.checked);
    }
    updateProgress();
    $('save-status').textContent = saved ? '已自动保存到此浏览器' : '当前页面内保留进度';
    announce(`已选择 ${optionLetter(question, optionId)}。已完成 ${countAnswered()} 题。`);
  }
  function navigateTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL) return;
    state.cursor = index;
    persist();
    if ($('app-dialog').open) $('app-dialog').close();
    showView('test', false);
    renderQuestion();
  }
  function goNext() {
    if (!state.answers[QUESTIONS[state.cursor].id]) {
      toast('请先选择一个答案，再继续。');
      return;
    }
    if (countAnswered() === TOTAL) {
      finishQuiz();
      return;
    }
    if (state.cursor < TOTAL - 1) navigateTo(state.cursor + 1);
    else {
      const missing = QUESTIONS.findIndex((question) => !state.answers[question.id]);
      navigateTo(missing);
      toast(`还有 ${TOTAL - countAnswered()} 道题未答，已跳到第一道未答题。`);
    }
  }
  function skipQuestion() {
    for (let offset = 1; offset < TOTAL; offset++) {
      const index = (state.cursor + offset) % TOTAL;
      if (!state.answers[QUESTIONS[index].id]) {
        navigateTo(index);
        return;
      }
    }
    toast('这已经是最后一道未答题。选择后就可以查看结果。');
  }

  // Pure, deterministic scoring. Never infer an answer for an unanswered question.
  function scoreAnswers(answers) {
    if (!answers || typeof answers !== 'object') throw new Error('答案格式不正确。');
    const scores = DOMAINS.map((domain) => ({id: domain.id, name: domain.name, raw: 0, max: 30, value: 0}));
    for (const question of QUESTIONS) {
      const option = question.options.find((item) => item.id === answers[question.id]);
      if (!option) throw new Error('请完成全部 50 道题，再生成结果。');
      scores.find((item) => item.id === question.domain).raw += option.score;
    }
    for (const score of scores) score.value = score.raw / score.max * 100;
    const raw = scores.reduce((sum, score) => sum + score.raw, 0);
    return {raw, max: 150, overall: raw / 150 * 100, dimensions: scores};
  }
  function tier(overall) {
    if (overall >= 85) return {title: '验证驱动的系统思考', description: '你在多数题目中偏向结构化、可验证的解决路径。下一步值得观察：面对真实约束时，你能否持续使用这些方法？'};
    if (overall >= 70) return {title: '结构化解决问题', description: '本次作答呈现出较明显的结构化思考倾向。把目标、假设和验证步骤写出来，可以让这些方法在复杂任务中更稳定。'};
    if (overall >= 50) return {title: '经验与结构并行', description: '你的选择同时包含经验判断与结构化方法。可以优先从一两个分项练起，让好方法从“知道”变成更稳定的习惯。'};
    return {title: '从直觉走向验证', description: '本次作答尚未持续选择系统拆解与证据检验的路径。这不代表你缺少潜质；把问题说清、一次验证一个假设，就是可操作的起点。'};
  }
  function dimensionDescription(score) {
    const domain = DOMAINS.find((item) => item.id === score.id);
    return score.value >= 80 ? domain.high : score.value >= 55 ? domain.middle : domain.low;
  }
  function getPracticeDimensions(scored) {
    return [...scored.dimensions].sort((a, b) => a.value - b.value).slice(0, 2).map((score) => DOMAINS.find((domain) => domain.id === score.id));
  }
  function pointAt(index, radius, cx = 210, cy = 173) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  }
  function polygonPoints(radius, cx = 210, cy = 173) {
    return DOMAINS.map((_, index) => pointAt(index, radius, cx, cy).map((n) => n.toFixed(2)).join(',')).join(' ');
  }
  function radarSVG(scored) {
    const radius = 112;
    const grid = [20, 40, 60, 80, 100].map((level) => `<polygon points="${polygonPoints(radius * level / 100)}" fill="none" stroke="${level === 100 ? '#c9d0d0' : '#e7ebE7'}" stroke-width="1"/>`).join('');
    const axes = DOMAINS.map((_, index) => { const p = pointAt(index, radius); return `<line x1="210" y1="173" x2="${p[0]}" y2="${p[1]}" stroke="#e3e8e3" stroke-width="1"/>`; }).join('');
    const coordinates = scored.dimensions.map((score, index) => pointAt(index, radius * score.value / 100));
    const profile = coordinates.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ');
    const dots = coordinates.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#3758d7" stroke="#fff" stroke-width="1.5"/>`).join('');
    const labels = scored.dimensions.map((score, index) => {
      const p = pointAt(index, 142);
      const anchor = index === 1 ? 'start' : index === 4 ? 'end' : 'middle';
      const y = p[1] + (index === 0 ? -2 : index === 2 || index === 3 ? 6 : 0);
      return `<text x="${p[0]}" y="${y}" fill="#4e5a5f" text-anchor="${anchor}" font-size="11">${esc(score.name)}</text><text x="${p[0]}" y="${y + 17}" fill="#3758d7" text-anchor="${anchor}" font-size="11" font-weight="600">${fmt(score.value)}</text>`;
    }).join('');
    const desc = scored.dimensions.map((score) => `${score.name} ${fmt(score.value)} 分`).join('；');
    return `<svg viewBox="0 0 420 350" role="img" aria-labelledby="radar-title radar-desc"><title id="radar-title">五维倾向雷达图</title><desc id="radar-desc">${esc(desc)}。量程零到一百分。</desc>${grid}${axes}<text x="215" y="67" font-size="8" fill="#758187">100</text><text x="215" y="112" font-size="8" fill="#758187">60</text><text x="216" y="171" font-size="8" fill="#758187">0</text><polygon points="${profile}" fill="#3758d7" fill-opacity=".12" stroke="#3758d7" stroke-width="2"/>${dots}${labels}</svg>`;
  }
  function renderResult() {
    const level = tier(result.overall);
    $('overall-score').textContent = fmt(result.overall);
    $('score-label').textContent = level.title;
    $('score-description').textContent = level.description;
    $('radar-container').innerHTML = radarSVG(result);
    $('result-domains').innerHTML = result.dimensions.map((score, index) => {
      const domain = DOMAINS[index];
      return `<article class="result-dimension"><div class="d-head"><span>${esc(domain.name)}</span><span class="mono" style="color:var(--muted);font-size:10px">0${index + 1}</span></div><div class="d-en">${domain.en}</div><div class="d-score mono">${fmt(score.value)} <small>/ 100</small></div><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${score.value}%"></div></div><p class="d-description">${esc(dimensionDescription(score))}</p></article>`;
    }).join('');
    const ranked = [...result.dimensions].sort((a, b) => b.value - a.value);
    const spread = ranked[0].value - ranked[ranked.length - 1].value;
    if (spread <= 10) {
      $('strength-title').textContent = '五个维度的分布较接近';
      $('strength-description').textContent = `本次最高与最低维度相差 ${fmt(spread)} 分，不宜把其中一项单独解释为突出优势。更值得观察的是，在真实问题中，你能否把这些方法连成完整流程。`;
    } else {
      const tied = ranked.filter((score) => score.raw === ranked[0].raw);
      const featured = tied.length > 1 ? tied : ranked.slice(0, 2);
      const names = featured.slice(0, 2).map((score) => score.name).join(' · ');
      $('strength-title').textContent = `相对突出：${names}${featured.length > 2 ? '等' : ''}`;
      $('strength-description').textContent = `在这套题中，你在${featured.slice(0, 2).map((score) => score.name).join('与')}上的选择更接近参考方法。这是本次作答中的相对特点，不等于其他维度不重要，也不能直接转换为某种岗位的胜任度。`;
    }
    $('strength-note').textContent = '真实工程通常需要目标澄清、结构组织、提出方案、严谨推理与纠错验证共同参与。可以把分项当作提醒，而不是把自己固定成某一种类型。';
    const practices = getPracticeDimensions(result);
    $('practice-heading').textContent = result.dimensions.every((score) => score.value >= 80)
      ? '把方法迁移到真实任务' : '把结果变成下一次练习';
    $('practice-list').innerHTML = practices.map((domain, index) => `<div class="practice-item"><span class="practice-index mono">0${index + 1}</span><div><h3>${esc(domain.name)} · ${esc(domain.principle)}</h3><p>${esc(domain.practice)}</p></div></div>`).join('');
    reviewFilter = 'all';
    $('improve-only').checked = false;
    $('review-section').open = false;
    renderReview();
  }
  function finishQuiz() {
    if (countAnswered() !== TOTAL) {
      toast(`还需要完成 ${TOTAL - countAnswered()} 道题。`);
      return;
    }
    try {
      result = scoreAnswers(state.answers);
    } catch (error) {
      toast(error.message);
      return;
    }
    if (!state.finishedAt) state.finishedAt = new Date().toISOString();
    persist();
    renderResult();
    showView('result');
    $('result-heading').focus({preventScroll: true});
    announce(`测试完成。总倾向评分 ${fmt(result.overall)} 分，满分一百分。结果仅供自我探索。`);
  }
  function renderReview() {
    $('review-filters').innerHTML = [{id: 'all', name: '全部'}, ...DOMAINS].map((domain) => `<button class="filter-btn${reviewFilter === domain.id ? ' active' : ''}" data-review-filter="${domain.id}" aria-pressed="${reviewFilter === domain.id}">${esc(domain.name)}</button>`).join('');
    const improveOnly = $('improve-only').checked;
    const chosen = QUESTIONS.map((question, index) => ({question, index, selected: question.options.find((option) => option.id === state.answers[question.id])})).filter(({question, selected}) => selected && (reviewFilter === 'all' || reviewFilter === question.domain) && (!improveOnly || selected.score < 3));
    $('review-count').textContent = `显示 ${chosen.length} 道题 · 情境题为参考路径，逻辑题为推理答案`;
    $('review-list').innerHTML = chosen.length ? chosen.map(({question, index, selected}) => {
      const best = question.options.find((option) => option.score === 3);
      const selectedLetter = optionLetter(question, selected.id);
      const bestLetter = optionLetter(question, best.id);
      const referenceLabel = question.domain === 'logic' ? '推理参考答案' : '本题较有利于该维度的路径';
      return `<details class="review-item"><summary><span class="review-qnum mono">${pad(index + 1)}</span><span>${esc(question.stem)}</span><span class="review-qscore mono">${selected.score} / 3</span></summary><div class="review-detail"><p class="review-choice"><strong>你的选择 · ${selectedLetter}</strong>　${esc(selected.text)}</p>${selected.id === best.id ? '<div class="reference">你的选择与本题的最高分参考选项一致。</div>' : `<div class="reference"><strong>${referenceLabel} · ${bestLetter}</strong><br>${esc(best.text)}</div>`}<p class="rationale">${esc(question.rationale)}</p></div></details>`;
    }).join('') : '<div class="review-empty">当前筛选下没有未得满分的题目。可以切换维度，或在真实任务中检验这些方法。</div>';
  }
  function dialogHeader(title) {
    return `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-close-dialog aria-label="关闭对话框">×</button></div>`;
  }
  function openDialog(content, action = null) {
    dialogAction = action;
    $('dialog-content').innerHTML = content;
    if (!$('app-dialog').open) $('app-dialog').showModal();
  }
  function showHelp() {
    openDialog(`${dialogHeader('怎样完成这份测试')}<div class="dialog-copy"><p><strong>50 道单选题，五个维度各 10 题。</strong>题目交错出现，不需要专业背景或查阅资料，也没有倒计时。</p><p>40 道情境题按你最可能采取的行动选择；10 道逻辑题只依据题面信息推理。每题只能选一项，可通过题目导航返回修改。全部作答后，才能生成总倾向分和五维画像。</p><p>进度自动保存在当前浏览器。桌面端可按 A—D 或 1—4 选择，按 Enter 进入下一题；手机端可点“题目总览”跳转。</p><p><strong>这是一份自编探索工具，不是职业资格或心理测量。</strong>参考排序不等于真实场景下永远正确的做法；本测试未经常模、信度和效度验证，不用于智商判断、招聘或诊断。</p><p>网页不主动发送作答内容到网络。保存结果图、下载报告也在浏览器中完成。</p></div><div class="dialog-actions"><button class="btn btn-primary" data-close-dialog>开始了解自己</button></div>`);
  }
  function showOverview() {
    openDialog(`${dialogHeader('题目总览')}<p class="dialog-copy" style="margin-bottom:17px">已完成 ${countAnswered()} / ${TOTAL} 题。点击题号跳转，深色为已作答，蓝色边框为当前题。</p><nav id="dialog-question-nav" class="question-nav dialog-question-nav" aria-label="跳转到题目">${makeQuestionNav()}</nav><div class="dialog-actions"><button class="btn btn-secondary" data-close-dialog>返回作答</button></div>`);
  }
  function requestReset(clearOnly = false) {
    const count = countAnswered();
    if (count === 0 && !state.startedAt && clearOnly) { toast('当前没有已保存的作答记录。'); return; }
    const title = clearOnly ? '清除本地作答记录？' : '重新开始一次测试？';
    const message = clearOnly
      ? '本次选择和完成记录将从当前浏览器删除。本页不会清除其他网站或应用的数据，已下载的报告不会被删除。'
      : '这会清除当前作答，回到第 1 题。旧结果将不再保留；需要留存时，请先下载结果图或报告。';
    openDialog(`${dialogHeader(title)}<div class="dialog-copy"><p>${message}</p></div><div class="dialog-actions"><button class="btn btn-secondary" data-close-dialog>取消</button><button class="btn ${clearOnly ? 'btn-danger' : 'btn-primary'}" id="confirm-dialog-action">${clearOnly ? '确认清除' : '重新开始'}</button></div>`, () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* In-memory state can still be cleared. */ }
      state = emptyState();
      result = null;
      $('app-dialog').close();
      if (clearOnly) {
        showView('welcome');
        toast('本测试的本地作答记录已清除。');
      } else {
        state.startedAt = new Date().toISOString();
        persist();
        showView('test');
        renderQuestion();
      }
    });
  }
  function localDateLabel(value = state.finishedAt) {
    const date = new Date(value || Date.now());
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function exportText() {
    if (!result) return;
    const level = tier(result.overall);
    const lines = [
      '你是否有当工程师的潜质？', '思维实验室 · 工程思维探索报告', `完成日期：${localDateLabel()}`, '',
      `总倾向评分：${fmt(result.overall)} / 100`, `画像名称：${level.title}`, level.description, '', '五个维度（各占总分 20%）'
    ];
    for (const score of result.dimensions) lines.push(`${score.name}：${fmt(score.value)} / 100（原始 ${score.raw}/30）`, dimensionDescription(score), '');
    lines.push('建议练习');
    for (const domain of getPracticeDimensions(result)) lines.push(`${domain.name}：${domain.practice}`, '');
    lines.push('逐题记录与参考解析');
    QUESTIONS.forEach((question, index) => {
      const selected = question.options.find((option) => option.id === state.answers[question.id]);
      const best = question.options.find((option) => option.score === 3);
      lines.push('', `${pad(index + 1)}. ${question.stem}`, `你的选择：${optionLetter(question, selected.id)}. ${selected.text}（${selected.score}/3 分）`, `${question.domain === 'logic' ? '推理参考答案' : '最高分参考路径'}：${optionLetter(question, best.id)}. ${best.text}`, `解析：${question.rationale}`);
    });
    lines.push('', '评分与边界', '40 道情境题按预设方法偏好分别计 0、1、2、3 分；10 道逻辑题答对 3 分，其他 0 分。总分 = 原始总分 / 150 × 100；维度分 = 维度原始分 / 30 × 100。显示最多保留一位小数。', '本测试为自编的思维探索工具，未经心理测量验证，没有人群百分位，不衡量智商，也不能预测真实工作表现。分数不是职业资格、招聘、淘汰或诊断依据。情境评分是题设下的参考排序，不是脱离场景的通用正确答案。');
    downloadBlob(new Blob(['\uFEFF' + lines.join('\n')], {type: 'text/plain;charset=utf-8'}), `engineering-mindset-report-${localDateLabel()}.txt`);
    toast('报告已生成，包含分项得分与 50 题解析。');
  }
  function roundRect(ctx, x, y, w, h, radius, fill, stroke) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 10) {
    let line = '', row = 0;
    for (const char of text) {
      const trial = line + char;
      if (ctx.measureText(trial).width > maxWidth && line) {
        ctx.fillText(line, x, y + row * lineHeight);
        line = char; row++;
        if (row >= maxLines) return y + row * lineHeight;
      } else line = trial;
    }
    if (line && row < maxLines) ctx.fillText(line, x, y + row * lineHeight);
    return y + (row + 1) * lineHeight;
  }
  function drawPosterRadar(ctx) {
    const cx = 805, cy = 376, radius = 116;
    const trace = (points) => { ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); };
    [20, 40, 60, 80, 100].forEach((value) => {
      trace(DOMAINS.map((_, index) => pointAt(index, radius * value / 100, cx, cy)));
      ctx.strokeStyle = '#d5dcd8'; ctx.lineWidth = 1; ctx.stroke();
    });
    DOMAINS.forEach((_, index) => {
      const p = pointAt(index, radius, cx, cy);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...p); ctx.strokeStyle = '#dfe4df'; ctx.lineWidth = 1; ctx.stroke();
    });
    const profile = result.dimensions.map((score, index) => pointAt(index, radius * score.value / 100, cx, cy));
    trace(profile); ctx.fillStyle = '#3758d720'; ctx.fill(); ctx.strokeStyle = '#3758d7'; ctx.lineWidth = 3; ctx.stroke();
    profile.forEach((p) => { ctx.beginPath(); ctx.arc(...p, 5, 0, Math.PI * 2); ctx.fillStyle = '#3758d7'; ctx.fill(); });
    result.dimensions.forEach((score, index) => {
      const p = pointAt(index, 151, cx, cy);
      ctx.textAlign = index === 1 ? 'left' : index === 4 ? 'right' : 'center';
      ctx.fillStyle = '#5d696d'; ctx.font = '22px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
      const labels = ['工程', '模块化', '创新', '逻辑', '归因纠错'];
      ctx.fillText(labels[index], p[0], p[1]);
      ctx.font = '600 22px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
      ctx.fillStyle = '#3758d7'; ctx.fillText(fmt(score.value), p[0], p[1] + 31);
    });
    ctx.textAlign = 'left';
  }
  async function saveImage() {
    if (!result) return;
    const button = $('save-image-button');
    const previousLabel = button.innerHTML;
    button.disabled = true; button.textContent = '正在生成…';
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1440;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器不支持结果图生成。');
      const font = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
      ctx.fillStyle = '#f5f5f2'; ctx.fillRect(0, 0, 1080, 1440);
      ctx.fillStyle = '#24282a'; [[72,70],[87,70],[72,85]].forEach(([x,y]) => ctx.fillRect(x,y,10,10));
      ctx.fillStyle = '#3758d7'; ctx.fillRect(87,85,10,10);
      ctx.font = `600 25px ${font}`; ctx.fillStyle = '#24282a'; ctx.fillText('思维实验室', 117, 94);
      ctx.font = `16px ${font}`; ctx.fillStyle = '#687479'; ctx.textAlign = 'right'; ctx.fillText('ENGINEERING MINDSET / 5D', 1008, 92); ctx.textAlign = 'left';
      ctx.fillStyle = '#24282a'; ctx.font = `600 52px ${font}`; ctx.fillText('我的工程思维画像', 72, 181);
      ctx.strokeStyle = '#d7ddda'; ctx.lineWidth = 1; ctx.beginPath();ctx.moveTo(72,211);ctx.lineTo(1008,211);ctx.stroke();
      ctx.font = `22px ${font}`; ctx.fillStyle = '#5d696d'; ctx.fillText('总倾向评分', 72, 272);
      const scoreText = fmt(result.overall);
      ctx.font = `500 ${scoreText.length > 3 ? 122 : 144}px ${font}`; ctx.fillStyle = '#24282a'; ctx.fillText(scoreText, 64, 423);
      const width = ctx.measureText(scoreText).width;
      ctx.font = `31px ${font}`; ctx.fillStyle = '#687479'; ctx.fillText('/ 100', 79 + width, 416);
      ctx.font = `600 28px ${font}`;ctx.fillStyle = '#3758d7';ctx.fillText(tier(result.overall).title, 72, 479);
      ctx.font = `18px ${font}`;ctx.fillStyle = '#687479';ctx.fillText(`50 道题完成 · ${localDateLabel()}`, 72, 520);
      drawPosterRadar(ctx);
      roundRect(ctx, 48, 568, 984, 561, 20, '#ffffff', '#d8dedb');
      ctx.font = `600 22px ${font}`;ctx.fillStyle = '#24282a';ctx.fillText('五个维度 · 每项满分 100', 84, 616);
      result.dimensions.forEach((score, index) => {
        const y = 682 + index * 89;
        ctx.font = `600 26px ${font}`;ctx.fillStyle = '#24282a';ctx.fillText(score.name, 84, y);
        ctx.font = `20px ${font}`;ctx.fillStyle = '#687479';ctx.fillText(DOMAINS[index].tag, 306, y);
        ctx.textAlign = 'right';ctx.font = `600 29px ${font}`;ctx.fillStyle = '#3758d7';ctx.fillText(fmt(score.value), 994, y);ctx.textAlign = 'left';
        roundRect(ctx, 84, y + 18, 910, 8, 4, '#e8ece7');
        if (score.value > 0) roundRect(ctx, 84, y + 18, 910 * score.value / 100, 8, 4, '#3758d7');
      });
      ctx.fillStyle = '#24282a';ctx.font = `600 29px ${font}`;ctx.fillText('潜质不是分数线，思考方法可以练习。', 72, 1202);
      ctx.fillStyle = '#657176';ctx.font = `22px ${font}`;
      wrapCanvasText(ctx, '分数只反映本次选择与参考方法的接近程度，未经心理测量验证，不衡量智商，不用于职业能力鉴定。', 72, 1253, 910, 35, 3);
      ctx.beginPath();ctx.moveTo(72,1350);ctx.lineTo(1008,1350);ctx.strokeStyle='#d7ddda';ctx.stroke();
      ctx.font = `17px ${font}`;ctx.fillStyle = '#687479';ctx.fillText('目标与约束  /  结构与接口  /  新路径  /  严谨推理  /  证据与纠错', 72, 1384);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片生成失败。')), 'image/png'));
      downloadBlob(blob, `engineering-mindset-result-${localDateLabel()}.png`);
      toast('结果图已生成：1080 × 1440。');
    } catch (_) {
      toast('当前浏览器未能生成结果图，可先下载文本报告。');
    } finally {
      button.disabled = false; button.innerHTML = previousLabel;
    }
  }

  $('start-button').addEventListener('click', () => {
    if (countAnswered() === TOTAL) { finishQuiz(); return; }
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    persist(); showView('test'); renderQuestion();
  });
  $('brand-button').addEventListener('click', () => {
    persist(); showView('welcome'); $('welcome-title').setAttribute('tabindex', '-1'); $('welcome-title').focus({preventScroll:true});
  });
  $('help-button').addEventListener('click', showHelp);
  $('overview-button').addEventListener('click', showOverview);
  $('welcome-reset').addEventListener('click', () => requestReset());
  $('retake-button').addEventListener('click', () => requestReset());
  $('clear-data-button').addEventListener('click', () => requestReset(true));
  $('prev-button').addEventListener('click', () => navigateTo(state.cursor - 1));
  $('next-button').addEventListener('click', goNext);
  $('skip-button').addEventListener('click', skipQuestion);
  $('options').addEventListener('change', (event) => {
    if (event.target.matches('input[type="radio"]')) selectOption(event.target.value);
  });
  $('question-nav').addEventListener('click', (event) => {
    const target = event.target.closest('[data-question-index]');
    if (target) navigateTo(Number(target.dataset.questionIndex));
  });
  $('review-filters').addEventListener('click', (event) => {
    const target = event.target.closest('[data-review-filter]');
    if (!target) return;
    reviewFilter = target.dataset.reviewFilter; renderReview();
    const current = $('review-filters').querySelector(`[data-review-filter="${reviewFilter}"]`);
    if (current) current.focus({preventScroll:true});
  });
  $('improve-only').addEventListener('change', renderReview);
  $('edit-answers-button').addEventListener('click', () => { showView('test'); renderQuestion(); });
  $('save-image-button').addEventListener('click', saveImage);
  $('export-text-button').addEventListener('click', exportText);
  $('app-dialog').addEventListener('click', (event) => {
    if (event.target === $('app-dialog')) { $('app-dialog').close(); return; }
    const target = event.target.closest('[data-close-dialog], [data-question-index], #confirm-dialog-action');
    if (!target) return;
    if (target.hasAttribute('data-close-dialog')) $('app-dialog').close();
    else if (target.hasAttribute('data-question-index')) navigateTo(Number(target.dataset.questionIndex));
    else if (target.id === 'confirm-dialog-action' && dialogAction) dialogAction();
  });
  $('app-dialog').addEventListener('close', () => { dialogAction = null; });
  document.addEventListener('keydown', (event) => {
    if (activeView !== 'test' || $('app-dialog').open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('textarea,input:not([type="radio"])'))) return;
    const key = event.key.toLowerCase();
    const index = 'abcd'.indexOf(key);
    const num = ['1','2','3','4'].indexOf(key);
    const choice = key.length === 1 && index >= 0 ? index : num;
    if (choice >= 0 && choice <= 3) {
      event.preventDefault();
      const option = QUESTIONS[state.cursor].options[choice];
      selectOption(option.id);
      const input = $('options').querySelector(`input[value="${option.id}"]`);
      if (input) input.focus({preventScroll:true});
    } else if (event.key === 'Enter' && !(target instanceof HTMLElement && target.closest('button,a,summary'))) {
      event.preventDefault(); goNext();
    }
  });
  state = loadState();
  buildIntro(); updateWelcome();
  // Expose only the pure scoring function for audit/reuse. State remains local to this page.
  window.EngineeringMindset = Object.freeze({version: DATA.version, calculate: scoreAnswers});
})();

