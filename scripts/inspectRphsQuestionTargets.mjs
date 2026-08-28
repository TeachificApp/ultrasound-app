import mysql from "mysql2/promise";

const url = process.env.RAILWAY_MYSQL_URL;
if (!url) throw new Error("RAILWAY_MYSQL_URL is required.");

const db = await mysql.createConnection(url);
try {
  const [folders] = await db.query(
    "SELECT id, name FROM question_bank_folders WHERE LOWER(name) = LOWER(?) ORDER BY id",
    ["RPhS"],
  );
  const [quizzes] = await db.query(
    "SELECT id, title, status FROM standalone_quizzes WHERE LOWER(title) LIKE ? ORDER BY id",
    ["%rphs%"],
  );
  const folderIds = folders.map((folder) => folder.id);
  let folderQuestionCount = 0;
  if (folderIds.length === 1) {
    const [[count]] = await db.query("SELECT COUNT(*) AS count FROM question_bank WHERE folder_id = ?", [folderIds[0]]);
    folderQuestionCount = Number(count.count);
  }
  const quizIds = quizzes.map((quiz) => quiz.id);
  const quizQuestionCounts = {};
  for (const quizId of quizIds) {
    const [[count]] = await db.query("SELECT COUNT(*) AS count FROM standalone_quiz_questions WHERE quiz_id = ?", [quizId]);
    quizQuestionCounts[quizId] = Number(count.count);
  }
  console.log(JSON.stringify({ folders, quizzes, folderQuestionCount, quizQuestionCounts }));
} finally {
  await db.end();
}
