import archiver from "archiver";
import { PassThrough } from "stream";

interface ScormOptions {
  title: string;
  description: string;
  questions: any[];
  passingScore: number;
  timeLimit: number | null;
  shuffleQuestions: boolean;
  format: "scorm12" | "scorm2004";
}

export async function generateScormPackage(options: ScormOptions): Promise<Buffer> {
  const { title, description, questions, passingScore, timeLimit, shuffleQuestions, format } = options;

  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    archive.on("error", reject);

    archive.pipe(passThrough);

    // Add manifest
    if (format === "scorm12") {
      archive.append(generateScorm12Manifest(title, description), { name: "imsmanifest.xml" });
    } else {
      archive.append(generateScorm2004Manifest(title, description), { name: "imsmanifest.xml" });
    }

    // Add the quiz player HTML
    archive.append(generateQuizHtml(title, questions, passingScore, timeLimit, shuffleQuestions, format), {
      name: "index.html",
    });

    // Add SCORM API wrapper
    archive.append(generateScormApi(format), { name: "scormapi.js" });

    // Add styles
    archive.append(generateStyles(), { name: "styles.css" });

    archive.finalize();
  });
}

function generateScorm12Manifest(title: string, description: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="quiz_${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${escapeXml(title)}</title>
      <item identifier="item1" identifierref="res1">
        <title>${escapeXml(title)}</title>
        <adlcp:masteryscore>${Math.round(passingScoreToDecimal(70) * 100)}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scormapi.js"/>
      <file href="styles.css"/>
    </resource>
  </resources>
</manifest>`;
}

function generateScorm2004Manifest(title: string, description: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="quiz_${Date.now()}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
    http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
    http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
    http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
    http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${escapeXml(title)}</title>
      <item identifier="item1" identifierref="res1">
        <title>${escapeXml(title)}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
      <file href="scormapi.js"/>
      <file href="styles.css"/>
    </resource>
  </resources>
</manifest>`;
}

function generateQuizHtml(
  title: string,
  questions: any[],
  passingScore: number,
  timeLimit: number | null,
  shuffleQuestions: boolean,
  format: "scorm12" | "scorm2004"
): string {
  const questionsJson = JSON.stringify(questions);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="quiz-app">
    <div id="start-screen" class="screen active">
      <h1>${escapeHtml(title)}</h1>
      <div class="quiz-info">
        <p><strong>Questions:</strong> <span id="question-count"></span></p>
        <p><strong>Passing Score:</strong> ${passingScore}%</p>
        ${timeLimit ? `<p><strong>Time Limit:</strong> ${Math.floor(timeLimit / 60)} minutes</p>` : ""}
      </div>
      <button id="start-btn" class="btn-primary" onclick="startQuiz()">Start Quiz</button>
    </div>
    <div id="quiz-screen" class="screen">
      <div class="quiz-header">
        <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
        <span id="question-number"></span>
        ${timeLimit ? `<span id="timer" class="timer"></span>` : ""}
      </div>
      <div id="question-container"></div>
      <div class="nav-buttons">
        <button id="prev-btn" class="btn-secondary" onclick="prevQuestion()">Previous</button>
        <button id="next-btn" class="btn-primary" onclick="nextQuestion()">Next</button>
        <button id="submit-btn" class="btn-primary" onclick="submitQuiz()" style="display:none">Submit</button>
      </div>
    </div>
    <div id="result-screen" class="screen">
      <h2 id="result-title"></h2>
      <div class="score-display">
        <div id="score-circle" class="score-circle">
          <span id="score-pct"></span>
        </div>
      </div>
      <p id="result-detail"></p>
    </div>
  </div>
  <script src="scormapi.js"></script>
  <script>
    var QUIZ_DATA = ${questionsJson};
    var PASSING_SCORE = ${passingScore};
    var TIME_LIMIT = ${timeLimit || "null"};
    var SHUFFLE = ${shuffleQuestions};
    var FORMAT = "${format}";
    var currentIdx = 0;
    var answers = {};
    var startTime = null;
    var timerInterval = null;

    function shuffleArray(arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    document.getElementById("question-count").textContent = QUIZ_DATA.length;

    function startQuiz() {
      if (SHUFFLE) QUIZ_DATA = shuffleArray(QUIZ_DATA);
      startTime = new Date();
      ScormAPI.initialize();
      document.getElementById("start-screen").classList.remove("active");
      document.getElementById("quiz-screen").classList.add("active");
      if (TIME_LIMIT) startTimer();
      renderQuestion();
    }

    function startTimer() {
      var remaining = TIME_LIMIT;
      var el = document.getElementById("timer");
      timerInterval = setInterval(function() {
        remaining--;
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        el.textContent = m + ":" + (s < 10 ? "0" : "") + s;
        if (remaining <= 0) { clearInterval(timerInterval); submitQuiz(); }
      }, 1000);
    }

    function renderQuestion() {
      var q = QUIZ_DATA[currentIdx];
      var container = document.getElementById("question-container");
      var html = '<div class="question"><h3>Question ' + (currentIdx + 1) + ' of ' + QUIZ_DATA.length + '</h3>';
      html += '<p class="question-text">' + (q.stem || q.questionText || "") + '</p>';

      if (q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select") {
        var options = q.options || q.choices || [];
        var isMulti = q.type === "multiple_select" || q.allowMultiple;
        var inputType = isMulti ? "checkbox" : "radio";
        html += '<div class="options">';
        for (var i = 0; i < options.length; i++) {
          var opt = options[i];
          var optText = opt.text || opt.choiceText || opt.label || "";
          var optId = opt.id || i;
          var checked = "";
          if (answers[currentIdx]) {
            if (isMulti && answers[currentIdx].indexOf(optId) >= 0) checked = "checked";
            else if (!isMulti && answers[currentIdx] === optId) checked = "checked";
          }
          html += '<label class="option"><input type="' + inputType + '" name="q' + currentIdx + '" value="' + optId + '" ' + checked + ' onchange="saveAnswer(this)"> ' + optText + '</label>';
        }
        html += '</div>';
      } else if (q.type === "short_answer" || q.type === "long_answer" || q.type === "fill_blank") {
        var val = answers[currentIdx] || "";
        html += '<textarea class="text-answer" onchange="saveTextAnswer(this)" placeholder="Type your answer...">' + val + '</textarea>';
      } else if (q.type === "numeric") {
        var nval = answers[currentIdx] || "";
        html += '<input type="number" class="numeric-answer" value="' + nval + '" onchange="saveNumericAnswer(this)" placeholder="Enter a number">';
      }

      html += '</div>';
      container.innerHTML = html;

      // Update navigation
      document.getElementById("progress-fill").style.width = ((currentIdx + 1) / QUIZ_DATA.length * 100) + "%";
      document.getElementById("question-number").textContent = (currentIdx + 1) + " / " + QUIZ_DATA.length;
      document.getElementById("prev-btn").style.display = currentIdx > 0 ? "inline-block" : "none";
      document.getElementById("next-btn").style.display = currentIdx < QUIZ_DATA.length - 1 ? "inline-block" : "none";
      document.getElementById("submit-btn").style.display = currentIdx === QUIZ_DATA.length - 1 ? "inline-block" : "none";
    }

    function saveAnswer(el) {
      var q = QUIZ_DATA[currentIdx];
      var isMulti = q.type === "multiple_select" || q.allowMultiple;
      if (isMulti) {
        var checked = document.querySelectorAll('input[name="q' + currentIdx + '"]:checked');
        answers[currentIdx] = Array.from(checked).map(function(c) { return c.value; });
      } else {
        answers[currentIdx] = el.value;
      }
    }

    function saveTextAnswer(el) { answers[currentIdx] = el.value; }
    function saveNumericAnswer(el) { answers[currentIdx] = el.value; }

    function nextQuestion() { if (currentIdx < QUIZ_DATA.length - 1) { currentIdx++; renderQuestion(); } }
    function prevQuestion() { if (currentIdx > 0) { currentIdx--; renderQuestion(); } }

    function calcScore() {
      var earned = 0, total = 0;
      for (var i = 0; i < QUIZ_DATA.length; i++) {
        var q = QUIZ_DATA[i];
        var pts = q.points || 1;
        total += pts;
        var ans = answers[i];
        if (!ans) continue;

        if (q.type === "multiple_choice" || q.type === "true_false") {
          var options = q.options || q.choices || [];
          var correct = options.find(function(o) { return o.isCorrect || o.correct; });
          if (correct && (String(ans) === String(correct.id) || String(ans) === String(options.indexOf(correct)))) {
            earned += pts;
          }
        } else if (q.type === "multiple_select") {
          var options = q.options || q.choices || [];
          var correctIds = options.filter(function(o) { return o.isCorrect || o.correct; }).map(function(o, idx) { return String(o.id || idx); });
          var selected = Array.isArray(ans) ? ans.map(String) : [];
          if (correctIds.length === selected.length && correctIds.every(function(id) { return selected.indexOf(id) >= 0; })) {
            earned += pts;
          }
        } else if (q.type === "numeric") {
          var numAns = parseFloat(ans);
          var correct = q.numericAnswer || q.correctAnswer;
          var tol = q.numericTolerance || 0;
          if (!isNaN(numAns) && Math.abs(numAns - correct) <= tol) {
            earned += pts;
          }
        } else if (q.type === "fill_blank") {
          var accepted = q.fillBlankAnswers || q.acceptedAnswers || [];
          if (accepted.some(function(a) { return a.toLowerCase().trim() === String(ans).toLowerCase().trim(); })) {
            earned += pts;
          }
        }
        // short_answer and long_answer are not auto-graded
      }
      return { earned: earned, total: total, pct: total > 0 ? Math.round((earned / total) * 100) : 0 };
    }

    function submitQuiz() {
      if (timerInterval) clearInterval(timerInterval);
      var result = calcScore();
      var passed = result.pct >= PASSING_SCORE;
      var elapsed = Math.round((new Date() - startTime) / 1000);

      // Report to LMS
      ScormAPI.setScore(result.earned, result.total, result.pct);
      ScormAPI.setStatus(passed ? "passed" : "failed");
      ScormAPI.setTime(elapsed);
      ScormAPI.commit();
      ScormAPI.terminate();

      // Show results
      document.getElementById("quiz-screen").classList.remove("active");
      document.getElementById("result-screen").classList.add("active");
      document.getElementById("result-title").textContent = passed ? "Congratulations!" : "Not Passed";
      document.getElementById("result-title").className = passed ? "pass" : "fail";
      document.getElementById("score-pct").textContent = result.pct + "%";
      document.getElementById("score-circle").className = "score-circle " + (passed ? "pass" : "fail");
      document.getElementById("result-detail").textContent = "You scored " + result.earned + " out of " + result.total + " points (" + result.pct + "%). Passing score: " + PASSING_SCORE + "%.";
    }
  </script>
</body>
</html>`;
}

function generateScormApi(format: "scorm12" | "scorm2004"): string {
  if (format === "scorm12") {
    return `// SCORM 1.2 API Wrapper
var ScormAPI = (function() {
  var api = null;
  function findAPI(win) {
    var attempts = 0;
    while (!win.API && win.parent && win.parent !== win && attempts < 10) {
      win = win.parent; attempts++;
    }
    return win.API || null;
  }
  function getAPI() {
    if (api) return api;
    api = findAPI(window);
    if (!api && window.opener) api = findAPI(window.opener);
    return api;
  }
  return {
    initialize: function() {
      var a = getAPI();
      if (a) a.LMSInitialize("");
    },
    setScore: function(raw, max, pct) {
      var a = getAPI();
      if (a) {
        a.LMSSetValue("cmi.core.score.raw", String(raw));
        a.LMSSetValue("cmi.core.score.max", String(max));
        a.LMSSetValue("cmi.core.score.min", "0");
      }
    },
    setStatus: function(status) {
      var a = getAPI();
      if (a) {
        var s = status === "passed" ? "passed" : "failed";
        a.LMSSetValue("cmi.core.lesson_status", s);
      }
    },
    setTime: function(seconds) {
      var a = getAPI();
      if (a) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        var t = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        a.LMSSetValue("cmi.core.session_time", t);
      }
    },
    commit: function() {
      var a = getAPI();
      if (a) a.LMSCommit("");
    },
    terminate: function() {
      var a = getAPI();
      if (a) a.LMSFinish("");
    }
  };
})();`;
  } else {
    return `// SCORM 2004 API Wrapper
var ScormAPI = (function() {
  var api = null;
  function findAPI(win) {
    var attempts = 0;
    while (!win.API_1484_11 && win.parent && win.parent !== win && attempts < 10) {
      win = win.parent; attempts++;
    }
    return win.API_1484_11 || null;
  }
  function getAPI() {
    if (api) return api;
    api = findAPI(window);
    if (!api && window.opener) api = findAPI(window.opener);
    return api;
  }
  return {
    initialize: function() {
      var a = getAPI();
      if (a) a.Initialize("");
    },
    setScore: function(raw, max, pct) {
      var a = getAPI();
      if (a) {
        a.SetValue("cmi.score.raw", String(raw));
        a.SetValue("cmi.score.max", String(max));
        a.SetValue("cmi.score.min", "0");
        a.SetValue("cmi.score.scaled", String(pct / 100));
      }
    },
    setStatus: function(status) {
      var a = getAPI();
      if (a) {
        a.SetValue("cmi.completion_status", "completed");
        a.SetValue("cmi.success_status", status === "passed" ? "passed" : "failed");
      }
    },
    setTime: function(seconds) {
      var a = getAPI();
      if (a) {
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        var t = "PT" + h + "H" + m + "M" + s + "S";
        a.SetValue("cmi.session_time", t);
      }
    },
    commit: function() {
      var a = getAPI();
      if (a) a.Commit("");
    },
    terminate: function() {
      var a = getAPI();
      if (a) a.Terminate("");
    }
  };
})();`;
  }
}

function generateStyles(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
#quiz-app { max-width: 700px; width: 100%; margin: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 2.5rem; }
.screen { display: none; }
.screen.active { display: block; }
h1 { font-size: 1.75rem; margin-bottom: 1rem; color: #1a1a2e; }
h3 { font-size: 1.1rem; color: #666; margin-bottom: 0.5rem; }
.quiz-info { margin: 1.5rem 0; padding: 1rem; background: #f0f9f9; border-radius: 8px; }
.quiz-info p { margin: 0.5rem 0; }
.btn-primary { background: #189aa1; color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
.btn-primary:hover { background: #147a80; }
.btn-secondary { background: #e2e8f0; color: #4a5568; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; }
.btn-secondary:hover { background: #cbd5e0; }
.quiz-header { margin-bottom: 1.5rem; }
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-bottom: 0.75rem; }
.progress-fill { height: 100%; background: #189aa1; border-radius: 3px; transition: width 0.3s; }
.timer { float: right; font-weight: 600; color: #e53e3e; }
.question-text { font-size: 1.2rem; margin: 1rem 0 1.5rem; line-height: 1.5; }
.options { display: flex; flex-direction: column; gap: 0.75rem; }
.option { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: border-color 0.2s; }
.option:hover { border-color: #189aa1; }
.option input { width: 18px; height: 18px; }
.text-answer, .numeric-answer { width: 100%; padding: 0.875rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; resize: vertical; min-height: 100px; }
.numeric-answer { min-height: auto; }
.nav-buttons { display: flex; gap: 1rem; margin-top: 2rem; justify-content: space-between; }
.score-display { display: flex; justify-content: center; margin: 2rem 0; }
.score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; }
.score-circle.pass { background: #c6f6d5; color: #22543d; }
.score-circle.fail { background: #fed7d7; color: #742a2a; }
#result-title.pass { color: #22543d; }
#result-title.fail { color: #742a2a; }
#result-detail { text-align: center; color: #4a5568; }`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function passingScoreToDecimal(score: number): number {
  return score / 100;
}
