/* ============================
   APP.JS — JEE Mains Quiz Engine (Multi-Paper)
   ============================ */

// ==========================================
// State
// ==========================================
const state = {
  selectedPaperIndex: 0,
  mode: 'full',
  activeSections: [],
  questions: [],
  currentIndex: 0,
  answers: {},
  marked: new Set(),
  score: 0,
  submitted: false,
  reviewMode: false,
  timerInterval: null,
  timeRemaining: 0,
  startTime: null
};

// ==========================================
// DOM Helpers
// ==========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  landing: $('#landing-screen'),
  quiz: $('#quiz-screen'),
  results: $('#results-screen'),
  canvas: $('#particles-canvas'),

  paperTabs: $('#paper-tabs'),
  sectionCards: $('#section-cards'),

  btnStartFull: $('#btn-start-full'),
  btnStartSection: $('#btn-start-section'),
  sectionPicker: $('#section-picker'),

  header: {
    home: $('#btn-home'),
    sectionBadge: $('#current-section-badge'),
    timer: $('#timer'),
    timerDisplay: $('#timer-display'),
    scoreDisplay: $('#score-display'),
    submit: $('#btn-submit')
  },

  progressBar: $('#progress-bar'),
  progressText: $('#progress-text'),
  ribbon: $('#question-nav-ribbon'),

  question: {
    container: $('#question-container'),
    number: $('#question-number'),
    typeBadge: $('#question-type-badge'),
    topic: $('#question-topic'),
    text: $('#question-text'),
    imageContainer: $('#question-image-container'),
    image: $('#question-image'),
    optionsContainer: $('#options-container'),
    numericalContainer: $('#numerical-container'),
    numericalInput: $('#numerical-input'),
    saveNumerical: $('#btn-save-numerical')
  },

  footer: {
    prev: $('#btn-prev'),
    next: $('#btn-next'),
    clear: $('#btn-clear'),
    mark: $('#btn-mark')
  },

  modal: {
    overlay: $('#modal-overlay'),
    title: $('#modal-title'),
    text: $('#modal-text'),
    cancel: $('#modal-cancel'),
    confirm: $('#modal-confirm')
  },

  results: {
    screen: $('#results-screen'),
    badge: $('#results-badge'),
    subtitle: $('#results-subtitle'),
    ringFill: $('#score-ring-fill'),
    ringValue: $('#score-ring-value'),
    ringTotal: $('#score-ring-total'),
    stats: $('#results-stats'),
    breakdown: $('#results-breakdown'),
    review: $('#btn-review'),
    restart: $('#btn-restart')
  }
};

// ==========================================
// Get current paper
// ==========================================
function getCurrentPaper() {
  return allPapers[state.selectedPaperIndex];
}

// ==========================================
// Particles Background
// ==========================================
function initParticles() {
  const canvas = dom.canvas;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((w * h) / 15000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.4 + 0.1
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(108, 99, 255, ${p.alpha})`;
      ctx.fill();
    });

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108, 99, 255, ${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();
  window.addEventListener('resize', () => { resize(); createParticles(); });
}

// ==========================================
// Screen Management
// ==========================================
function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${screenId}`).classList.add('active');
  window.scrollTo(0, 0);
}

// ==========================================
// Landing Page — Paper Selector
// ==========================================
function selectPaper(index) {
  state.selectedPaperIndex = index;

  // Update tab active states
  dom.paperTabs.querySelectorAll('.paper-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  // Refresh section cards
  renderSectionCards();
}

function renderSectionCards() {
  const paper = getCurrentPaper();
  const colors = ['#6C63FF', '#00C9A7', '#FF6B6B'];

  let html = '';
  paper.sections.forEach((section, i) => {
    const qCount = section.questions.length;
    html += `
      <div class="section-card" data-section="${i}" style="--accent: ${colors[i]}">
        <div class="section-card-icon">${section.icon}</div>
        <h3>${section.name}</h3>
        <p>${qCount} Question${qCount !== 1 ? 's' : ''}</p>
        <div class="section-card-bar"></div>
      </div>
    `;
  });
  dom.sectionCards.innerHTML = html;

  // Re-attach click listeners
  dom.sectionCards.querySelectorAll('.section-card').forEach(card => {
    card.addEventListener('click', () => {
      const si = parseInt(card.dataset.section);
      startQuiz([si]);
    });
  });

  // Update paper tab counts
  allPapers.forEach((p, idx) => {
    const totalQs = p.sections.reduce((sum, s) => sum + s.questions.length, 0);
    const countEl = $(`#paper-tab-count-${idx}`);
    if (countEl) countEl.textContent = `${totalQs} Qs`;
  });
}

// ==========================================
// Quiz Initialization
// ==========================================
function startQuiz(sectionIndices) {
  const paper = getCurrentPaper();
  state.activeSections = sectionIndices;
  state.questions = [];
  state.answers = {};
  state.marked = new Set();
  state.score = 0;
  state.currentIndex = 0;
  state.submitted = false;
  state.reviewMode = false;

  sectionIndices.forEach(si => {
    const section = paper.sections[si];
    section.questions.forEach(q => {
      state.questions.push({
        ...q,
        sectionIndex: si,
        sectionName: section.name,
        sectionIcon: section.icon,
        sectionColor: section.color
      });
    });
  });

  // Set timer based on number of questions
  const totalQs = state.questions.length;
  if (sectionIndices.length === paper.sections.length) {
    state.timeRemaining = paper.duration * 60;
  } else {
    // Proportional time
    const totalAllQs = paper.sections.reduce((s, sec) => s + sec.questions.length, 0);
    state.timeRemaining = Math.ceil((totalQs / totalAllQs) * paper.duration * 60);
  }
  state.startTime = Date.now();

  showScreen('quiz-screen');
  buildRibbon();
  renderQuestion();
  startTimer();
  updateScore();
}

// ==========================================
// Timer
// ==========================================
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      clearInterval(state.timerInterval);
      submitQuiz();
    }
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const t = state.timeRemaining;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  dom.header.timerDisplay.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  dom.header.timer.classList.remove('warning', 'danger');
  if (t <= 300) {
    dom.header.timer.classList.add('danger');
  } else if (t <= 900) {
    dom.header.timer.classList.add('warning');
  }
}

// ==========================================
// Question Rendering
// ==========================================
function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const idx = state.currentIndex;

  // Meta
  dom.question.number.textContent = `Q${idx + 1}`;
  dom.question.topic.textContent = q.topic;

  if (q.type === 'numerical') {
    dom.question.typeBadge.textContent = 'NUMERICAL';
    dom.question.typeBadge.classList.add('numerical');
  } else {
    dom.question.typeBadge.textContent = 'MCQ';
    dom.question.typeBadge.classList.remove('numerical');
  }

  // Section badge
  dom.header.sectionBadge.textContent = `${q.sectionIcon} ${q.sectionName}`;
  dom.header.sectionBadge.style.borderColor = q.sectionColor;

  // Question text
  dom.question.text.textContent = q.text;

  // Question Image
  if (q.image) {
    dom.question.image.src = q.image;
    dom.question.imageContainer.classList.remove('hidden');
  } else {
    dom.question.imageContainer.classList.add('hidden');
  }

  // Options / Numerical
  if (q.type === 'mcq') {
    dom.question.optionsContainer.classList.remove('hidden');
    dom.question.numericalContainer.classList.add('hidden');
    renderOptions(q);
  } else {
    dom.question.optionsContainer.classList.add('hidden');
    dom.question.numericalContainer.classList.remove('hidden');
    renderNumerical(q);
  }

  // Progress
  const total = state.questions.length;
  dom.progressBar.style.width = `${((idx + 1) / total) * 100}%`;
  dom.progressText.textContent = `${idx + 1} / ${total}`;

  // Footer buttons
  dom.footer.prev.disabled = idx === 0;

  if (idx === total - 1) {
    dom.footer.next.innerHTML = `Finish <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  } else {
    dom.footer.next.innerHTML = `Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  }

  // Mark button
  const isMarked = state.marked.has(q.id);
  dom.footer.mark.classList.toggle('marked', isMarked);
  dom.footer.mark.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isMarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    ${isMarked ? 'Marked' : 'Mark for Review'}
  `;

  // Update ribbon
  updateRibbon();

  // Re-animate
  dom.question.container.style.animation = 'none';
  dom.question.container.offsetHeight;
  dom.question.container.style.animation = 'fadeIn 0.3s ease-out';

  // Hide footer buttons during review
  if (state.reviewMode) {
    dom.footer.clear.classList.add('hidden');
    dom.footer.mark.classList.add('hidden');
    dom.header.submit.classList.add('hidden');
  } else {
    dom.footer.clear.classList.remove('hidden');
    dom.footer.mark.classList.remove('hidden');
    dom.header.submit.classList.remove('hidden');
  }

  // Render LaTeX math
  if (window.renderMathInElement) {
    renderMathInElement(dom.question.container, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }
}

function renderOptions(q) {
  const letters = ['A', 'B', 'C', 'D'];
  const savedAnswer = state.answers[q.id];
  let html = '';

  q.options.forEach((opt, i) => {
    let classes = 'option';
    if (state.reviewMode) {
      classes += ' review-disabled';
      if (i === q.answer) classes += ' correct';
      if (savedAnswer && savedAnswer.value === i && i !== q.answer) classes += ' wrong';
      if (savedAnswer && savedAnswer.value === i && i === q.answer) classes += ' correct';
    } else {
      if (savedAnswer && savedAnswer.value === i) classes += ' selected';
    }

    html += `
      <div class="${classes}" data-index="${i}">
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
      </div>
    `;
  });

  dom.question.optionsContainer.innerHTML = html;

  if (!state.reviewMode) {
    dom.question.optionsContainer.querySelectorAll('.option').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        selectOption(q.id, idx);
      });
    });
  }
}

function renderNumerical(q) {
  const savedAnswer = state.answers[q.id];
  dom.question.numericalInput.value = savedAnswer ? savedAnswer.value : '';

  const oldReveal = dom.question.numericalContainer.querySelector('.numerical-answer-reveal');
  if (oldReveal) oldReveal.remove();

  if (state.reviewMode) {
    dom.question.numericalInput.disabled = true;
    dom.question.saveNumerical.classList.add('hidden');

    const correct = q.answer;
    const userVal = savedAnswer ? savedAnswer.value : 'Not answered';
    const isCorrect = savedAnswer && parseFloat(savedAnswer.value) === parseFloat(correct);

    const reveal = document.createElement('div');
    reveal.className = `numerical-answer-reveal ${isCorrect ? '' : 'wrong'}`;
    reveal.innerHTML = `Your answer: <strong>${userVal}</strong> | Correct answer: <strong>${correct}</strong>`;
    dom.question.numericalContainer.appendChild(reveal);
  } else {
    dom.question.numericalInput.disabled = false;
    dom.question.saveNumerical.classList.remove('hidden');
  }
}

function selectOption(questionId, optionIndex) {
  state.answers[questionId] = { type: 'mcq', value: optionIndex };
  renderQuestion();
  updateScore();
}

// ==========================================
// Navigation Ribbon
// ==========================================
function buildRibbon() {
  let html = '';
  state.questions.forEach((q, i) => {
    html += `<button class="q-nav-btn" data-index="${i}">${i + 1}</button>`;
  });
  dom.ribbon.innerHTML = html;

  dom.ribbon.querySelectorAll('.q-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentIndex = parseInt(btn.dataset.index);
      renderQuestion();
    });
  });
}

function updateRibbon() {
  dom.ribbon.querySelectorAll('.q-nav-btn').forEach((btn, i) => {
    const q = state.questions[i];
    btn.className = 'q-nav-btn';

    if (state.reviewMode) {
      const saved = state.answers[q.id];
      if (!saved) {
        btn.classList.add('review-unanswered');
      } else if (q.type === 'mcq') {
        btn.classList.add(saved.value === q.answer ? 'review-correct' : 'review-wrong');
      } else {
        btn.classList.add(parseFloat(saved.value) === parseFloat(q.answer) ? 'review-correct' : 'review-wrong');
      }
    } else {
      if (i === state.currentIndex) btn.classList.add('active');
      if (state.answers[q.id]) btn.classList.add('answered');
      if (state.marked.has(q.id)) btn.classList.add('marked');
    }
  });

  const activeBtn = dom.ribbon.querySelector('.q-nav-btn.active') || dom.ribbon.querySelector(`.q-nav-btn[data-index="${state.currentIndex}"]`);
  if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

// ==========================================
// Score Calculation
// ==========================================
function calculateScore() {
  let correct = 0, wrong = 0, unanswered = 0;
  const sectionScores = {};

  state.questions.forEach(q => {
    const key = q.sectionName;
    if (!sectionScores[key]) sectionScores[key] = { correct: 0, wrong: 0, unanswered: 0, total: 0, icon: q.sectionIcon, color: q.sectionColor };
    sectionScores[key].total++;

    const saved = state.answers[q.id];
    if (!saved) {
      unanswered++;
      sectionScores[key].unanswered++;
    } else if (q.type === 'mcq') {
      if (saved.value === q.answer) {
        correct++;
        sectionScores[key].correct++;
      } else {
        wrong++;
        sectionScores[key].wrong++;
      }
    } else {
      if (parseFloat(saved.value) === parseFloat(q.answer)) {
        correct++;
        sectionScores[key].correct++;
      } else {
        wrong++;
        sectionScores[key].wrong++;
      }
    }
  });

  const paper = getCurrentPaper();
  const totalScore = (correct * paper.marking.correct) + (wrong * paper.marking.incorrect);
  const maxScore = state.questions.length * paper.marking.correct;

  return { correct, wrong, unanswered, totalScore, maxScore, sectionScores };
}

function updateScore() {
  const { totalScore } = calculateScore();
  state.score = totalScore;
  dom.header.scoreDisplay.textContent = totalScore;
}

// ==========================================
// Submit Quiz
// ==========================================
function submitQuiz() {
  clearInterval(state.timerInterval);
  state.submitted = true;
  const results = calculateScore();
  showResults(results);
}

function showResults(results) {
  showScreen('results-screen');

  const pct = results.maxScore > 0 ? results.totalScore / results.maxScore : 0;
  let badge, subtitle;
  if (pct >= 0.8) { badge = '🏆'; subtitle = 'Outstanding Performance!'; }
  else if (pct >= 0.6) { badge = '🌟'; subtitle = 'Great Job!'; }
  else if (pct >= 0.4) { badge = '💪'; subtitle = 'Good Effort!'; }
  else if (pct >= 0.2) { badge = '📚'; subtitle = 'Keep Practicing!'; }
  else { badge = '🎯'; subtitle = 'Room for Improvement'; }

  dom.results.badge.textContent = badge;
  dom.results.subtitle.textContent = subtitle;

  // Score Ring SVG gradient
  const svg = dom.results.screen.querySelector('.score-ring-svg');
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = 'scoreGradient';
    gradient.innerHTML = '<stop offset="0%" stop-color="#6C63FF"/><stop offset="50%" stop-color="#B06CFF"/><stop offset="100%" stop-color="#FF6B9D"/>';
    defs.appendChild(gradient);
    svg.prepend(defs);
  }

  const circumference = 2 * Math.PI * 85;
  const scorePct = Math.max(0, results.totalScore) / results.maxScore;
  const offset = circumference * (1 - scorePct);

  // Reset then animate
  dom.results.ringFill.style.transition = 'none';
  dom.results.ringFill.style.strokeDashoffset = circumference;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dom.results.ringFill.style.transition = 'stroke-dashoffset 1.5s ease-out';
      dom.results.ringFill.style.strokeDashoffset = offset;
    });
  });

  dom.results.ringValue.textContent = results.totalScore;
  dom.results.ringTotal.textContent = `/ ${results.maxScore}`;

  // Stats
  const accuracy = results.correct + results.wrong > 0
    ? Math.round((results.correct / (results.correct + results.wrong)) * 100) : 0;

  dom.results.stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-value correct">${results.correct}</div>
      <div class="stat-label">Correct</div>
    </div>
    <div class="stat-card">
      <div class="stat-value wrong">${results.wrong}</div>
      <div class="stat-label">Wrong</div>
    </div>
    <div class="stat-card">
      <div class="stat-value skipped">${results.unanswered}</div>
      <div class="stat-label">Skipped</div>
    </div>
    <div class="stat-card">
      <div class="stat-value accuracy">${accuracy}%</div>
      <div class="stat-label">Accuracy</div>
    </div>
  `;

  // Section Breakdown
  let breakdownHTML = '';
  const paper = getCurrentPaper();
  Object.entries(results.sectionScores).forEach(([name, data]) => {
    const sectionScore = (data.correct * paper.marking.correct) + (data.wrong * paper.marking.incorrect);
    const sectionMax = data.total * paper.marking.correct;
    const pct = sectionMax > 0 ? Math.max(0, sectionScore) / sectionMax * 100 : 0;

    breakdownHTML += `
      <div class="breakdown-card">
        <div class="breakdown-header">
          <div class="breakdown-title">
            <span>${data.icon}</span>
            <span>${name}</span>
          </div>
          <div class="breakdown-score" style="color: ${data.color}">${sectionScore} / ${sectionMax}</div>
        </div>
        <div class="breakdown-bar-container">
          <div class="breakdown-bar" style="width: ${pct}%; background: ${data.color}"></div>
        </div>
        <div class="breakdown-details">
          <span class="breakdown-detail"><span class="dot green"></span> ${data.correct} correct</span>
          <span class="breakdown-detail"><span class="dot red"></span> ${data.wrong} wrong</span>
          <span class="breakdown-detail"><span class="dot gray"></span> ${data.unanswered} skipped</span>
        </div>
      </div>
    `;
  });

  dom.results.breakdown.innerHTML = breakdownHTML;
}

// ==========================================
// Review Mode
// ==========================================
function enterReview() {
  state.reviewMode = true;
  state.currentIndex = 0;
  showScreen('quiz-screen');

  clearInterval(state.timerInterval);
  dom.header.timerDisplay.textContent = 'REVIEW';
  dom.header.timer.classList.remove('warning', 'danger');

  buildRibbon();
  renderQuestion();
}

// ==========================================
// Event Listeners
// ==========================================
function init() {
  initParticles();

  // Initialize landing page
  renderSectionCards();

  // Paper tab switching
  dom.paperTabs.querySelectorAll('.paper-tab').forEach((tab, i) => {
    tab.addEventListener('click', () => selectPaper(parseInt(tab.dataset.paper)));
  });

  // Landing — Start Full Paper
  dom.btnStartFull.addEventListener('click', () => {
    const paper = getCurrentPaper();
    const indices = paper.sections.map((_, i) => i);
    startQuiz(indices);
  });

  // Landing — Choose Subject
  dom.btnStartSection.addEventListener('click', () => {
    dom.sectionPicker.classList.toggle('hidden');
  });

  // Section buttons (from picker)
  $$('.btn-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const si = parseInt(btn.dataset.section);
      startQuiz([si]);
    });
  });

  // Navigation
  dom.footer.prev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  });

  dom.footer.next.addEventListener('click', () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderQuestion();
    } else if (!state.reviewMode) {
      showSubmitModal();
    }
  });

  // Clear Response
  dom.footer.clear.addEventListener('click', () => {
    const q = state.questions[state.currentIndex];
    delete state.answers[q.id];
    if (q.type === 'numerical') dom.question.numericalInput.value = '';
    renderQuestion();
    updateScore();
  });

  // Mark for Review
  dom.footer.mark.addEventListener('click', () => {
    const q = state.questions[state.currentIndex];
    if (state.marked.has(q.id)) {
      state.marked.delete(q.id);
    } else {
      state.marked.add(q.id);
    }
    renderQuestion();
  });

  // Save Numerical
  dom.question.saveNumerical.addEventListener('click', () => {
    const q = state.questions[state.currentIndex];
    const val = dom.question.numericalInput.value.trim();
    if (val !== '') {
      state.answers[q.id] = { type: 'numerical', value: parseFloat(val) };
      renderQuestion();
      updateScore();
    }
  });

  dom.question.numericalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.question.saveNumerical.click();
  });

  // Submit
  dom.header.submit.addEventListener('click', showSubmitModal);

  // Modal
  dom.modal.cancel.addEventListener('click', () => dom.modal.overlay.classList.add('hidden'));
  dom.modal.confirm.addEventListener('click', () => {
    dom.modal.overlay.classList.add('hidden');
    submitQuiz();
  });

  // Home
  dom.header.home.addEventListener('click', () => {
    if (!state.submitted && !state.reviewMode) {
      if (!confirm('Are you sure? Your progress will be lost.')) return;
    }
    clearInterval(state.timerInterval);
    showScreen('landing-screen');
  });

  // Review
  dom.results.review.addEventListener('click', enterReview);

  // Restart
  dom.results.restart.addEventListener('click', () => {
    showScreen('landing-screen');
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!$('#quiz-screen').classList.contains('active')) return;
    if (document.activeElement === dom.question.numericalInput) return;

    switch (e.key) {
      case 'ArrowLeft':
        dom.footer.prev.click();
        break;
      case 'ArrowRight':
        dom.footer.next.click();
        break;
      case '1': case 'a': case 'A':
        if (!state.reviewMode) {
          const q = state.questions[state.currentIndex];
          if (q.type === 'mcq') selectOption(q.id, 0);
        }
        break;
      case '2': case 'b': case 'B':
        if (!state.reviewMode) {
          const q = state.questions[state.currentIndex];
          if (q.type === 'mcq') selectOption(q.id, 1);
        }
        break;
      case '3': case 'c': case 'C':
        if (!state.reviewMode) {
          const q = state.questions[state.currentIndex];
          if (q.type === 'mcq') selectOption(q.id, 2);
        }
        break;
      case '4': case 'd': case 'D':
        if (!state.reviewMode) {
          const q = state.questions[state.currentIndex];
          if (q.type === 'mcq') selectOption(q.id, 3);
        }
        break;
    }
  });
}

function showSubmitModal() {
  const answered = Object.keys(state.answers).length;
  const total = state.questions.length;
  const unanswered = total - answered;
  const markedCount = state.marked.size;

  dom.modal.title.textContent = 'Submit Quiz?';
  dom.modal.text.innerHTML = `
    You have answered <strong>${answered}</strong> out of <strong>${total}</strong> questions.<br>
    ${unanswered > 0 ? `⚠️ <strong>${unanswered}</strong> questions are unanswered.<br>` : ''}
    ${markedCount > 0 ? `📌 <strong>${markedCount}</strong> questions are marked for review.<br>` : ''}
    <br>Are you sure you want to submit?
  `;
  dom.modal.overlay.classList.remove('hidden');
}

// ==========================================
// Initialize
// ==========================================
document.addEventListener('DOMContentLoaded', init);
