import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { z } from "zod";
import { canManageAccounts, canManageRole, canSeeOwner, canSeePersonalData, publicUser, requireAuth, signToken } from "./auth.js";
import { createMysqlStore } from "./mysql-store.js";
import { getStore, setStore } from "./store.js";
import { LEAD_PROVIDERS, getProvider, providerMeta, type LeadProvider, type LeadQuery, type RawLead } from "./lead-providers.js";
import type { AiModelConfig, AiSiteBuilderProject, AiSiteBuilderSetting, Customer, Deal, Exam, ExamAttempt, ExamQuestion, LeadSourceConfig, PlanTask, PlanTemplate, SessionUser, Todo, TradeDocument, WebsiteOpportunity } from "./types.js";

export const app = express();
app.use(cors());
app.use(express.json());

const serverModuleDir = path.dirname(fileURLToPath(import.meta.url));
const goodJobProjectRoot = path.resolve(serverModuleDir, "..", "..");

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function accountUser(user: ReturnType<typeof getStore>["users"][number]) {
  return { ...publicUser(user), status: user.status };
}

async function sendOutboundEmail(user: ReturnType<typeof getStore>["users"][number], payload: { to: string; subject: string; body: string }) {
  if (!user.outboundEmail || !user.smtpHost || !user.smtpUser || !user.smtpPassword) {
    throw new Error("请先在个人信息页完整配置发件邮箱、SMTP服务器、账号和授权码");
  }
  const transport = process.env.NODE_ENV === "test"
    ? nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true })
    : nodemailer.createTransport({
      host: user.smtpHost,
      port: user.smtpPort || 465,
      secure: user.smtpSecure ?? true,
      auth: {
        user: user.smtpUser,
        pass: user.smtpPassword
      }
    });
  return transport.sendMail({
    from: `"${user.emailSenderName || user.name}" <${user.outboundEmail}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.body
  });
}

function examQuestionsFor(examId: string) {
  const store = getStore();
  const linkedIds = store.examQuestionLinks
    .filter((link) => link.examId === examId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((link) => link.questionId);
  const linked = linkedIds
    .map((questionId) => store.examQuestions.find((question) => question.id === questionId))
    .filter(Boolean) as ExamQuestion[];
  if (linked.length) return linked;
  return store.examQuestions.filter((question) => question.examId === examId);
}

function bankQuestions() {
  const store = getStore();
  return store.examQuestions
    .filter((question) => question.examId === "bank" || !question.examId || !store.exams.some((exam) => exam.id === question.examId))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

function examWithRuntimeStats(exam: Exam) {
  const store = getStore();
  const questions = examQuestionsFor(exam.id);
  const attempts = store.examAttempts.filter((attempt) => attempt.examId === exam.id);
  const passRate = attempts.length
    ? Math.round((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100)
    : exam.passRate;
  return {
    ...exam,
    questionCount: questions.length || exam.questionCount,
    passRate
  };
}

function examReport() {
  const store = getStore();
  const attempts = store.examAttempts;
  const totalAttempts = attempts.length;
  const passedAttempts = attempts.filter((attempt) => attempt.passed).length;
  const averageScore = totalAttempts ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts) : 0;
  const retakeAttempts = attempts.filter((attempt) => !attempt.passed).length;
  const questionCount = bankQuestions().length;
  const difficultyRows = ["easy", "medium", "hard"].map((difficulty) => {
    const count = bankQuestions().filter((question) => question.difficulty === difficulty).length;
    return {
      difficulty,
      label: difficulty === "easy" ? "基础题" : difficulty === "hard" ? "高阶题" : "应用题",
      count,
      ratio: questionCount ? Math.round((count / questionCount) * 100) : 0
    };
  });
  const categoryRows = store.exams.map((exam) => {
    const examAttempts = attempts.filter((attempt) => attempt.examId === exam.id);
    const participants = new Set(examAttempts.map((attempt) => attempt.userId)).size;
    const passRate = examAttempts.length ? Math.round((examAttempts.filter((attempt) => attempt.passed).length / examAttempts.length) * 100) : exam.passRate;
    const avgScore = examAttempts.length ? Math.round(examAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / examAttempts.length) : 0;
    return { examId: exam.id, title: exam.title, category: exam.category, participants, passRate, avgScore };
  });
  const latestAttempts = attempts.slice(0, 6).map((attempt) => {
    const exam = store.exams.find((item) => item.id === attempt.examId);
    const user = store.users.find((item) => item.id === attempt.userId);
    return {
      ...attempt,
      examTitle: exam?.title || "未知考试",
      category: exam?.category || "未分类",
      userName: user?.name || "未知用户"
    };
  });
  return {
    totalAttempts,
    passedAttempts,
    retakeAttempts,
    averageScore,
    questionCount,
    categoryRows,
    difficultyRows,
    latestAttempts
  };
}

function refreshExamStats(exam: Exam) {
  const store = getStore();
  const attempts = store.examAttempts.filter((attempt) => attempt.examId === exam.id);
  const questionCount = examQuestionsFor(exam.id).length;
  exam.questionCount = questionCount || exam.questionCount;
  exam.passRate = attempts.length ? Math.round((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100) : exam.passRate;
  exam.updatedAt = new Date().toISOString();
}

const examQuestionSchema = z.object({
  stem: z.string().min(1),
  category: z.string().min(1).default("产品知识"),
  options: z.array(z.string().min(1)).min(2).max(6),
  answerIndex: z.number().int().nonnegative().optional(),
  answerIndexes: z.array(z.number().int().nonnegative()).optional(),
  questionType: z.enum(["single", "multiple"]).optional(),
  tags: z.array(z.string()).optional().default([]),
  explanation: z.string().min(1).default("请在题库维护中补充解析。"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

function uniqueSortedIndexes(values: number[]) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function correctIndexesFor(question: ExamQuestion) {
  return uniqueSortedIndexes(question.answerIndexes?.length ? question.answerIndexes : [question.answerIndex]);
}

function indexesEqual(left: number[], right: number[]) {
  const a = uniqueSortedIndexes(left);
  const b = uniqueSortedIndexes(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function buildExamQuestion(body: z.infer<typeof examQuestionSchema>, index = 0): ExamQuestion {
  const answerIndexes = uniqueSortedIndexes(body.answerIndexes?.length ? body.answerIndexes : [body.answerIndex ?? 0]);
  if (answerIndexes.some((answerIndex) => answerIndex >= body.options.length)) {
    throw new Error("正确答案序号超出选项数量");
  }
  return {
    id: `q_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    examId: "bank",
    category: body.category,
    stem: body.stem,
    options: body.options,
    answerIndex: answerIndexes[0],
    answerIndexes,
    questionType: body.questionType || (answerIndexes.length > 1 ? "multiple" : "single"),
    tags: body.tags || [],
    explanation: body.explanation,
    difficulty: body.difficulty,
    updatedAt: new Date().toISOString()
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, store: getStore().mode });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

app.post("/api/auth/login", (req, res) => {
  const body = loginSchema.parse(req.body);
  const { users } = getStore();
  const user = users.find((item) => item.email === body.email && item.password === body.password && item.status === "active");
  if (!user) {
    res.status(401).json({ message: "账号或密码错误" });
    return;
  }
  const sessionUser = publicUser(user);
  res.json({ token: signToken(sessionUser), user: sessionUser });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/profile", requireAuth, (req, res) => {
  const user = getStore().users.find((item) => item.id === req.user!.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  res.json({ user: accountUser(user) });
});

app.patch("/api/profile/email-binding", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    outboundEmail: z.string().email(),
    emailSenderName: z.string().min(1).max(80),
    emailSignature: z.string().max(800).default(""),
    smtpHost: z.string().max(180).default(""),
    smtpPort: z.number().int().min(1).max(65535).default(465),
    smtpSecure: z.boolean().default(true),
    smtpUser: z.string().max(180).default(""),
    smtpPassword: z.string().max(300).optional().default("")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const user = store.users.find((item) => item.id === req.user!.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  user.outboundEmail = body.outboundEmail;
  user.emailSenderName = body.emailSenderName;
  user.emailSignature = body.emailSignature;
  user.smtpHost = body.smtpHost;
  user.smtpPort = body.smtpPort;
  user.smtpSecure = body.smtpSecure;
  user.smtpUser = body.smtpUser;
  if (body.smtpPassword) user.smtpPassword = body.smtpPassword;
  await store.persist();
  const sessionUser = publicUser(user);
  res.json({ user: accountUser(user), token: signToken(sessionUser) });
}));

app.post("/api/profile/test-email", requireAuth, asyncRoute(async (_req, res) => {
  const store = getStore();
  const user = store.users.find((item) => item.id === _req.user!.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  if (!user.outboundEmail) {
    res.status(400).json({ message: "请先保存发件邮箱" });
    return;
  }
  try {
    const info = await sendOutboundEmail(user, {
      to: user.outboundEmail,
      subject: "GoodJob CRM SMTP 测试邮件",
      body: `这是一封来自 GoodJob CRM 的 SMTP 测试邮件。\n\n账号：${user.email}\n时间：${new Date().toISOString()}`
    });
    res.json({ ok: true, messageId: info.messageId, simulated: process.env.NODE_ENV === "test" });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "测试邮件发送失败" });
  }
}));

app.post("/api/profile/send-development-email", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    to: z.string().email(),
    company: z.string().min(1).max(120),
    subject: z.string().min(1).max(160),
    body: z.string().min(10).max(3000)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const user = store.users.find((item) => item.id === req.user!.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  let mailInfo: Awaited<ReturnType<typeof sendOutboundEmail>>;
  try {
    mailInfo = await sendOutboundEmail(user, { to: body.to, subject: body.subject, body: body.body });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "邮件发送失败" });
    return;
  }
  const sentAt = new Date().toISOString();
  user.lastDevelopmentEmailAt = sentAt;
  user.lastDevelopmentEmailTo = body.to;
  user.lastDevelopmentEmailSubject = body.subject;
  await store.persist();
  res.json({
    sent: {
      id: `mail_${Date.now()}`,
      status: "sent",
      simulated: process.env.NODE_ENV === "test",
      messageId: mailInfo.messageId,
      from: user.outboundEmail,
      senderName: user.emailSenderName || user.name,
      to: body.to,
      company: body.company,
      subject: body.subject,
      body: body.body,
      sentAt
    },
    user: accountUser(user)
  });
}));

app.post("/api/prospect-list/:id/send-development-email", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(160),
    body: z.string().min(10).max(3000)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const user = store.users.find((item) => item.id === req.user!.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  const opportunity = store.websiteOpportunities.find((item) => item.id === req.params.id && canSeeOwner(req.user!, item.ownerId, item.teamId));
  if (!opportunity) {
    res.status(404).json({ message: "搜客线索不存在或无权访问" });
    return;
  }
  let mailInfo: Awaited<ReturnType<typeof sendOutboundEmail>>;
  try {
    mailInfo = await sendOutboundEmail(user, { to: body.to, subject: body.subject, body: body.body });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "邮件发送失败" });
    return;
  }
  const sentAt = new Date().toISOString();
  user.lastDevelopmentEmailAt = sentAt;
  user.lastDevelopmentEmailTo = body.to;
  user.lastDevelopmentEmailSubject = body.subject;
  opportunity.lastDevelopmentEmailAt = sentAt;
  opportunity.lastDevelopmentEmailTo = body.to;
  opportunity.lastDevelopmentEmailSubject = body.subject;
  await store.persist();
  res.json({
    sent: {
      id: `mail_${Date.now()}`,
      status: "sent",
      simulated: process.env.NODE_ENV === "test",
      messageId: mailInfo.messageId,
      from: user.outboundEmail,
      senderName: user.emailSenderName || user.name,
      to: body.to,
      company: opportunity.company,
      subject: body.subject,
      body: body.body,
      sentAt
    },
    opportunity,
    user: accountUser(user)
  });
}));

app.get("/api/accounts", requireAuth, (req, res) => {
  if (!canManageAccounts(req.user)) {
    res.status(403).json({ message: "无账号管理权限" });
    return;
  }
  const { users } = getStore();
  res.json({ accounts: users.map(accountUser) });
});

app.post("/api/accounts", requireAuth, asyncRoute(async (req, res) => {
  if (!canManageAccounts(req.user)) {
    res.status(403).json({ message: "无账号管理权限" });
    return;
  }
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["sales", "manager", "admin", "super_admin"]).default("sales"),
    teamId: z.string().min(1).optional()
  });
  const body = schema.parse(req.body);
  if (!canManageRole(req.user!, body.role)) {
    res.status(403).json({ message: "无权创建该角色账号" });
    return;
  }
  const store = getStore();
  if (store.users.some((user) => user.email === body.email)) {
    res.status(409).json({ message: "账号邮箱已存在" });
    return;
  }
  const teamId = body.role === "super_admin" || body.role === "admin" ? "all" : body.teamId || req.user!.teamId;
  const user = {
    id: `u_${Date.now()}`,
    name: body.name,
    email: body.email,
    password: body.password,
    role: body.role,
    teamId,
    avatar: body.name.slice(0, 2).toUpperCase(),
    status: "active" as const
  };
  store.users.unshift(user);
  await store.persist();
  res.json({ account: accountUser(user) });
}));

app.patch("/api/accounts/:id/password", requireAuth, asyncRoute(async (req, res) => {
  if (!canManageAccounts(req.user)) {
    res.status(403).json({ message: "无账号管理权限" });
    return;
  }
  const schema = z.object({ password: z.string().min(6) });
  const body = schema.parse(req.body);
  const store = getStore();
  const user = store.users.find((item) => item.id === req.params.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  if (!canManageRole(req.user!, user.role)) {
    res.status(403).json({ message: "无权设置该账号密码" });
    return;
  }
  user.password = body.password;
  await store.persist();
  res.json({ account: accountUser(user) });
}));

app.patch("/api/accounts/:id/disable", requireAuth, asyncRoute(async (req, res) => {
  if (!canManageAccounts(req.user)) {
    res.status(403).json({ message: "无账号管理权限" });
    return;
  }
  const store = getStore();
  const user = store.users.find((item) => item.id === req.params.id);
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  if (user.id === req.user!.id) {
    res.status(400).json({ message: "不能停用当前登录账号" });
    return;
  }
  if (!canManageRole(req.user!, user.role)) {
    res.status(403).json({ message: "无权停用该角色账号" });
    return;
  }
  user.status = "disabled";
  await store.persist();
  res.json({ account: accountUser(user) });
}));

app.delete("/api/accounts/:id", requireAuth, asyncRoute(async (req, res) => {
  if (!canManageAccounts(req.user)) {
    res.status(403).json({ message: "无账号管理权限" });
    return;
  }
  const store = getStore();
  const index = store.users.findIndex((item) => item.id === req.params.id);
  const user = index >= 0 ? store.users[index] : null;
  if (!user) {
    res.status(404).json({ message: "账号不存在" });
    return;
  }
  if (user.id === req.user!.id) {
    res.status(400).json({ message: "不能删除当前登录账号" });
    return;
  }
  if (!canManageRole(req.user!, user.role)) {
    res.status(403).json({ message: "无权删除该角色账号" });
    return;
  }
  store.users.splice(index, 1);
  await store.persist();
  res.json({ ok: true, id: req.params.id });
}));

app.get("/api/customers", requireAuth, (req, res) => {
  const { customers } = getStore();
  const scoped = customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  res.json({ customers: scoped });
});

app.post("/api/customers", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    company: z.string().min(1),
    country: z.string().min(1).default("未知"),
    contact: z.string().min(1).default("待维护"),
    stage: z.string().min(1).default("询盘"),
    amount: z.number().int().nonnegative().default(0),
    billingName: z.string().optional().default(""),
    billingAddress: z.string().optional().default(""),
    documentContact: z.string().optional().default(""),
    defaultPortDischarge: z.string().optional().default(""),
    defaultIncoterm: z.string().optional().default("FOB Tianjin"),
    defaultPaymentTerm: z.string().optional().default("30% T/T deposit, 70% before shipment")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const customer = {
    id: `c_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    health: 72,
    nextReminder: "明天 10:00",
    wecomBound: false,
    ...body
  };
  store.customers.unshift(customer);
  await store.persist();
  res.json({ customer });
}));

app.patch("/api/customers/:id", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    company: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    stage: z.string().min(1).optional(),
    amount: z.number().int().nonnegative().optional(),
    nextReminder: z.string().min(1).optional(),
    wecomBound: z.boolean().optional(),
    billingName: z.string().optional(),
    billingAddress: z.string().optional(),
    documentContact: z.string().optional(),
    defaultPortDischarge: z.string().optional(),
    defaultIncoterm: z.string().optional(),
    defaultPaymentTerm: z.string().optional()
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const customer = store.customers.find((item) => item.id === req.params.id);
  if (!customer || !canSeeOwner(req.user!, customer.ownerId, customer.teamId)) {
    res.status(404).json({ message: "客户不存在" });
    return;
  }
  Object.assign(customer, body);
  await store.persist();
  res.json({ customer });
}));

app.post("/api/customers/bulk-delete", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ ids: z.array(z.string()).min(1).max(200) });
  const body = schema.parse(req.body);
  const store = getStore();
  const ids = [...new Set(body.ids)];
  const deleted = store.customers.filter((customer) => ids.includes(customer.id) && canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  if (!deleted.length) {
    res.status(404).json({ message: "未找到可删除的客户" });
    return;
  }
  const deletedIds = new Set(deleted.map((customer) => customer.id));
  const deletedNames = deleted.map((customer) => customer.company);
  store.customers = store.customers.filter((customer) => !deletedIds.has(customer.id));
  store.deals = store.deals.filter((deal) => !deletedIds.has(deal.customerId));
  store.todos = store.todos.filter((todo) => !deletedNames.some((name) => todo.related.includes(name) || todo.title.includes(name)));
  await store.persist();
  const customers = store.customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  res.json({ deleted, customers });
}));

app.get("/api/todos", requireAuth, (req, res) => {
  const store = getStore();
  const archived = archiveExpiredTodos(store.todos, new Date());
  if (archived.length) void store.persist();
  const { todos } = store;
  const scoped = todos.filter((todo) => canSeePersonalData(req.user!, todo.ownerId));
  res.json({ todos: scoped });
});

app.post("/api/todos", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    type: z.enum(["customer", "knowledge", "exam", "ocr", "other"]).default("other"),
    priority: z.enum(["high", "medium", "normal"]).default("normal"),
    dueAt: z.string().default(""),
    related: z.string().default("")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const todo = {
    id: `t_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    done: false,
    status: "pending" as const,
    pinState: "" as const,
    sortOrder: nextTodoSortOrder(store.todos, req.user!.id),
    createdAt: new Date().toISOString(),
    historyAt: "",
    ...body
  };
  if (shouldArchiveTodo(todo)) {
    todo.historyAt = new Date().toISOString();
    todo.status = "pending" as const;
  }
  store.todos.unshift(todo);
  await store.persist();
  res.json({ todo });
}));

const planTaskSchema = z.object({
  title: z.string().min(1),
  phase: z.string().min(1).default("计划任务"),
  category: z.string().min(1).default("客户开发"),
  priority: z.enum(["high", "medium", "normal"]).default("normal"),
  status: z.enum(["planned", "active", "done"]).default("planned"),
  dueAt: z.string().default(""),
  target: z.string().default(""),
  description: z.string().default("")
});

function sortPlanTasks(tasks: PlanTask[]) {
  const statusWeight: Record<PlanTask["status"], number> = { active: 0, planned: 1, done: 2 };
  const priorityWeight: Record<PlanTask["priority"], number> = { high: 0, medium: 1, normal: 2 };
  return [...tasks].sort((left, right) => {
    return statusWeight[left.status] - statusWeight[right.status]
      || priorityWeight[left.priority] - priorityWeight[right.priority]
      || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  });
}

const defaultPlanTemplateDrafts: Array<Omit<PlanTemplate, "id" | "ownerId" | "teamId" | "updatedAt">> = [
  { section: "knowledge", title: "产品分类地图", summary: "压力、温度、流量、液位、分析仪表、记录仪；每类写 3 个典型型号和应用场景。", output: "输出物：1页分类卡", badge: "必会", badgeTone: "green", phase: "前置知识", category: "产品知识", priority: "high", target: "完成6类仪表的分类卡和典型应用说明", description: "整理压力、温度、流量、液位、分析仪表、记录仪的型号、应用行业、常见客户问题。", sortOrder: 10 },
  { section: "knowledge", title: "关键参数追问表", summary: "量程、精度、介质、温压、连接、输出信号、供电、防护、材质；必须能向客户追问。", output: "输出物：参数确认模板", badge: "必会", badgeTone: "green", phase: "前置知识", category: "参数训练", priority: "high", target: "形成可复制的英文参数确认表", description: "把量程、精度、介质、温度压力、接口、输出信号、供电和材质整理成询盘追问模板。", sortOrder: 20 },
  { section: "knowledge", title: "证书与资料包", summary: "CE、RoHS、EMC、ATEX/IECEx、防爆、SIL、校准证书、ISO、材质报告，按产品归档。", output: "输出物：资料索引", badge: "资料化", badgeTone: "amber", phase: "前置知识", category: "资料维护", priority: "medium", target: "完成认证资料索引并标注适用产品", description: "按产品类型整理证书、测试报告、校准文件和对外解释口径，避免客户索要资料时临时翻找。", sortOrder: 30 },
  { section: "knowledge", title: "行业应用场景", summary: "水处理、油气、化工、食品制药、HVAC、电力、船舶、环保设备、OEM 机械。", output: "输出物：行业话术", badge: "场景", badgeTone: "", phase: "前置知识", category: "场景训练", priority: "medium", target: "每个行业写出1条切入话术和1个典型应用", description: "围绕水处理、油气、化工、食品制药、HVAC、电力、船舶和OEM机械整理客户痛点。", sortOrder: 40 },
  { section: "knowledge", title: "竞品替代口径", summary: "WIKA、Endress+Hauser、Yokogawa、Emerson、KROHNE、Ashcroft、Dwyer 的替代切入点。", output: "输出物：竞品对照表", badge: "谈判", badgeTone: "red", phase: "前置知识", category: "竞品研究", priority: "medium", target: "完成至少5个竞品品牌的替代切入点", description: "整理竞品主打产品、客户关注点、我方可替代卖点和风险边界。", sortOrder: 50 },
  { section: "persona", title: "工业自动化经销商", summary: "要稳定供货、利润空间、资料齐全和快速响应。", output: "关键词：instrument distributor / automation supplier / country\n首触达：目录、代理优势、证书包、热销型号", badge: "高匹配", badgeTone: "green", phase: "客户画像", category: "客户开发", priority: "high", target: "筛选30家高匹配经销商并完成首触达", description: "使用instrument distributor、automation supplier等关键词，按国家筛选官网、联系人、产品线和代理品牌。", sortOrder: 110 },
  { section: "persona", title: "系统集成商", summary: "关注项目参数匹配、交期、现场适配和技术支持。", output: "关键词：process automation integrator / control system integrator\n首触达：问应用场景、项目清单、参数范围", badge: "项目型", badgeTone: "aqua", phase: "客户画像", category: "客户开发", priority: "high", target: "筛选20家系统集成商并确认项目应用场景", description: "围绕process automation integrator等关键词查找项目型客户，首封邮件重点询问介质、量程、接口和证书需求。", sortOrder: 120 },
  { section: "persona", title: "OEM 设备厂", summary: "关注批量一致性、定制接口、长期价格和替代型号。", output: "关键词：machine manufacturer sensor / OEM instrument supplier\n首触达：发参数确认表、询问年用量和安装空间", badge: "批量型", badgeTone: "amber", phase: "客户画像", category: "客户开发", priority: "medium", target: "建立20家OEM设备厂名单并完成参数确认", description: "按设备类型筛选OEM客户，重点记录年用量、现用型号、接口、输出信号和目标价。", sortOrder: 130 },
  { section: "persona", title: "EPC / 工程承包商", summary: "关注认证、项目清单、交付风险、技术文件和投标资料。", output: "关键词：EPC water treatment instruments / project procurement\n首触达：索要 RFQ、项目清单、证书要求", badge: "高价值", badgeTone: "red", phase: "客户画像", category: "客户开发", priority: "medium", target: "筛选15家EPC客户并记录项目机会", description: "优先查水处理、化工、环保、电力工程客户，邮件重点强调证书、交付和项目配合能力。", sortOrder: 140 },
  { section: "execution", title: "第 1 天", summary: "整理仪表产品分类与参数卡；建立客户搜索关键词库 10 组。", output: "整理仪表产品分类与参数卡。\n建立客户搜索关键词库 10 组。", badge: "启动", badgeTone: "green", phase: "首周执行", category: "产品知识", priority: "high", target: "完成分类卡和10组关键词库", description: "先把产品分类、参数卡和客户搜索关键词准备好，避免盲目找客户。", sortOrder: 210 },
  { section: "execution", title: "第 2 天", summary: "整理证书、报价资料和应用案例；新增 30 家目标客户到 CRM。", output: "整理证书、报价资料和应用案例。\n新增 30 家目标客户到 CRM。", badge: "资料", badgeTone: "aqua", phase: "首周执行", category: "资料维护", priority: "high", target: "完成资料包并新增30家客户", description: "把资料准备和客户池新增绑定，新增客户必须带国家、官网、产品匹配点和下一步动作。", sortOrder: 220 },
  { section: "execution", title: "第 3 天", summary: "完成角色-痛点-话术表；首触达 20 家高匹配客户。", output: "完成角色-痛点-话术表。\n首触达 20 家高匹配客户。", badge: "触达", badgeTone: "amber", phase: "首周执行", category: "客户开发", priority: "high", target: "完成20家首触达并记录结果", description: "按客户角色使用不同邮件标题、开场和参数追问，不要所有客户发同一套内容。", sortOrder: 230 },
  { section: "execution", title: "第 4 天", summary: "整理竞品替代切入点 5 条；跟进昨日未回复客户 10 家。", output: "整理竞品替代切入点 5 条。\n跟进昨日未回复客户 10 家。", badge: "跟进", badgeTone: "amber", phase: "首周执行", category: "竞品研究", priority: "medium", target: "完成10家二次跟进和5条竞品切入点", description: "二次跟进要补充资料或新问题，不能只是重复问客户是否收到邮件。", sortOrder: 240 },
  { section: "execution", title: "第 5 天", summary: "制作参数确认表模板；深挖 3 家 A 类客户并写入 CRM。", output: "制作参数确认表模板。\n深挖 3 家 A 类客户并写入 CRM。", badge: "深挖", badgeTone: "red", phase: "首周执行", category: "客户开发", priority: "medium", target: "完成3家A类客户深挖", description: "深挖官网、联系人、产品线、可能项目、竞品品牌和下一步触达理由。", sortOrder: 250 },
  { section: "execution", title: "第 6-7 天", summary: "完成第一周开发周报；复盘并优化 ICP 与话术。", output: "完成第一周开发周报。\n复盘并优化 ICP 与话术。", badge: "复盘", badgeTone: "green", phase: "首周执行", category: "周报复盘", priority: "normal", target: "输出可汇报的首周复盘", description: "复盘新增客户、有效触达、有效回复、问题、资料缺口和下周优化动作。", sortOrder: 260 }
];

function sortPlanTemplates(templates: PlanTemplate[]) {
  return [...templates].sort((left, right) => left.sortOrder - right.sortOrder || String(left.updatedAt || "").localeCompare(String(right.updatedAt || "")));
}

async function ensurePlanTemplatesForUser(user: SessionUser) {
  const store = getStore();
  const existing = store.planTemplates.filter((template) => canSeePersonalData(user, template.ownerId));
  if (existing.length && existing.some((template) => template.section === "execution")) return sortPlanTemplates(existing);
  const now = new Date().toISOString();
  const drafts = existing.length ? defaultPlanTemplateDrafts.filter((template) => template.section === "execution") : defaultPlanTemplateDrafts;
  const created = drafts.map((template, index) => ({
    id: `ptpl_${user.id}_${Date.now()}_${index}`,
    ownerId: user.id,
    teamId: user.teamId,
    updatedAt: now,
    ...template
  }));
  store.planTemplates.push(...created);
  await store.persist();
  return sortPlanTemplates([...existing, ...created]);
}

app.get("/api/plan-tasks", requireAuth, (req, res) => {
  const { planTasks } = getStore();
  const scoped = planTasks.filter((task) => canSeePersonalData(req.user!, task.ownerId));
  res.json({ tasks: sortPlanTasks(scoped) });
});

app.post("/api/plan-tasks", requireAuth, asyncRoute(async (req, res) => {
  const body = planTaskSchema.parse(req.body);
  const now = new Date().toISOString();
  const store = getStore();
  const task: PlanTask = {
    id: `pt_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    createdAt: now,
    updatedAt: now,
    ...body
  };
  store.planTasks.unshift(task);
  await store.persist();
  res.json({ task });
}));

app.patch("/api/plan-tasks/:id", requireAuth, asyncRoute(async (req, res) => {
  const body = planTaskSchema.partial().parse(req.body);
  const store = getStore();
  const task = store.planTasks.find((item) => item.id === req.params.id);
  if (!task || !canSeePersonalData(req.user!, task.ownerId)) {
    res.status(404).json({ message: "计划任务不存在" });
    return;
  }
  Object.assign(task, body, { updatedAt: new Date().toISOString() });
  await store.persist();
  res.json({ task });
}));

app.delete("/api/plan-tasks/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.planTasks.findIndex((item) => item.id === req.params.id);
  const task = index >= 0 ? store.planTasks[index] : null;
  if (!task || !canSeePersonalData(req.user!, task.ownerId)) {
    res.status(404).json({ message: "计划任务不存在" });
    return;
  }
  store.planTasks.splice(index, 1);
  await store.persist();
  res.json({ ok: true, id: req.params.id });
}));

const planTemplateSchema = z.object({
  section: z.enum(["knowledge", "persona", "execution"]).default("knowledge"),
  title: z.string().min(1),
  summary: z.string().default(""),
  output: z.string().default(""),
  badge: z.string().default(""),
  badgeTone: z.string().default(""),
  phase: z.string().min(1).default("计划任务"),
  category: z.string().min(1).default("客户开发"),
  priority: z.enum(["high", "medium", "normal"]).default("normal"),
  target: z.string().default(""),
  description: z.string().default(""),
  sortOrder: z.coerce.number().int().default(0)
});

app.get("/api/plan-templates", requireAuth, asyncRoute(async (req, res) => {
  const templates = await ensurePlanTemplatesForUser(req.user!);
  res.json({ templates });
}));

app.post("/api/plan-templates", requireAuth, asyncRoute(async (req, res) => {
  const body = planTemplateSchema.parse(req.body);
  const store = getStore();
  const template: PlanTemplate = {
    id: `ptpl_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString(),
    ...body
  };
  store.planTemplates.push(template);
  await store.persist();
  res.json({ template });
}));

app.patch("/api/plan-templates/:id", requireAuth, asyncRoute(async (req, res) => {
  const body = planTemplateSchema.partial().parse(req.body);
  const store = getStore();
  const template = store.planTemplates.find((item) => item.id === req.params.id);
  if (!template || !canSeePersonalData(req.user!, template.ownerId)) {
    res.status(404).json({ message: "模板不存在" });
    return;
  }
  Object.assign(template, body, { updatedAt: new Date().toISOString() });
  await store.persist();
  res.json({ template });
}));

app.delete("/api/plan-templates/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.planTemplates.findIndex((item) => item.id === req.params.id);
  const template = index >= 0 ? store.planTemplates[index] : null;
  if (!template || !canSeePersonalData(req.user!, template.ownerId)) {
    res.status(404).json({ message: "模板不存在" });
    return;
  }
  store.planTemplates.splice(index, 1);
  await store.persist();
  res.json({ ok: true, id: req.params.id });
}));

app.get("/api/deals", requireAuth, (req, res) => {
  const { deals } = getStore();
  const scoped = deals.filter((deal) => canSeeOwner(req.user!, deal.ownerId, deal.teamId));
  res.json({ deals: scoped });
});

const dealStages = ["询盘", "已联系", "已报价", "样品", "谈判", "成交", "丢单"] as const;
const dealBodySchema = z.object({
  customerId: z.string().optional().default(""),
  title: z.string().min(1),
  stage: z.enum(dealStages).default("询盘"),
  product: z.string().max(200).optional().default(""),
  quantity: z.coerce.number().int().nonnegative().default(0),
  unitPrice: z.coerce.number().nonnegative().default(0),
  amount: z.coerce.number().nonnegative().optional(),
  nextAction: z.string().min(1).default("首次跟进")
});

function calculatedDealAmount(body: { amount?: number; quantity: number; unitPrice: number }) {
  if (typeof body.amount === "number") return Math.round(body.amount * 100) / 100;
  return Math.round(body.quantity * body.unitPrice * 100) / 100;
}

app.post("/api/deals", requireAuth, asyncRoute(async (req, res) => {
  const body = dealBodySchema.parse(req.body);
  const store = getStore();
  const customerId = body.customerId.trim();
  const customer = customerId ? store.customers.find((item) => item.id === customerId) : undefined;
  if (customerId && (!customer || !canSeeOwner(req.user!, customer.ownerId, customer.teamId))) {
    res.status(404).json({ message: "客户不存在" });
    return;
  }
  const deal = {
    id: `d_${Date.now()}`,
    customerId: customer?.id || "",
    title: body.title,
    stage: body.stage,
    product: body.product.trim(),
    quantity: body.quantity,
    unitPrice: body.unitPrice,
    amount: calculatedDealAmount(body),
    ownerId: customer?.ownerId || req.user!.id,
    teamId: customer?.teamId || req.user!.teamId,
    nextAction: body.nextAction,
    archivedAt: undefined
  };
  store.deals.unshift(deal);
  await store.persist();
  res.json({ deal });
}));

app.patch("/api/deals/:id", requireAuth, asyncRoute(async (req, res) => {
  const body = dealBodySchema.parse(req.body);
  const store = getStore();
  const deal = store.deals.find((item) => item.id === req.params.id);
  if (!deal || !canSeeOwner(req.user!, deal.ownerId, deal.teamId)) {
    res.status(404).json({ message: "商机不存在" });
    return;
  }
  if (deal.archivedAt) {
    res.status(400).json({ message: "已归档商机不能编辑" });
    return;
  }
  const customerId = body.customerId.trim();
  const customer = customerId ? store.customers.find((item) => item.id === customerId) : undefined;
  if (customerId && (!customer || !canSeeOwner(req.user!, customer.ownerId, customer.teamId))) {
    res.status(404).json({ message: "客户不存在" });
    return;
  }
  if (deal.stage === "成交" && body.stage === "丢单") {
    res.status(400).json({ message: "成交商机请归档，不能编辑为丢单" });
    return;
  }
  deal.customerId = customer?.id || "";
  deal.title = body.title;
  deal.stage = body.stage;
  deal.product = body.product.trim();
  deal.quantity = body.quantity;
  deal.unitPrice = body.unitPrice;
  deal.amount = calculatedDealAmount(body);
  deal.ownerId = customer?.ownerId || deal.ownerId;
  deal.teamId = customer?.teamId || deal.teamId;
  deal.nextAction = body.nextAction;
  await store.persist();
  res.json({ deal });
}));

app.patch("/api/deals/:id/stage", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ stage: z.enum(dealStages) });
  const store = getStore();
  const body = schema.parse(req.body);
  const deal = store.deals.find((item) => item.id === req.params.id);
  if (!deal || !canSeeOwner(req.user!, deal.ownerId, deal.teamId)) {
    res.status(404).json({ message: "商机不存在" });
    return;
  }
  if (deal.archivedAt) {
    res.status(400).json({ message: "已归档商机不能推进阶段" });
    return;
  }
  if (deal.stage === "成交" && body.stage === "丢单") {
    res.status(400).json({ message: "成交商机请归档，不再推进为丢单" });
    return;
  }
  deal.stage = body.stage;
  await store.persist();
  res.json({ deal });
}));

app.post("/api/deals/:id/archive", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const deal = store.deals.find((item) => item.id === req.params.id);
  if (!deal || !canSeeOwner(req.user!, deal.ownerId, deal.teamId)) {
    res.status(404).json({ message: "商机不存在" });
    return;
  }
  if (deal.stage !== "成交") {
    res.status(400).json({ message: "只有成交商机可以归档" });
    return;
  }
  deal.archivedAt = new Date().toISOString();
  deal.nextAction = "已成交归档，可在商机归档区查询";
  await store.persist();
  res.json({ deal });
}));

app.post("/api/deals/:id/lost", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const deal = store.deals.find((item) => item.id === req.params.id);
  if (!deal || !canSeeOwner(req.user!, deal.ownerId, deal.teamId)) {
    res.status(404).json({ message: "商机不存在" });
    return;
  }
  if (deal.archivedAt) {
    res.status(400).json({ message: "已归档商机不能重复丢单" });
    return;
  }
  if (deal.stage === "成交") {
    res.status(400).json({ message: "成交商机请归档，不能标记丢单" });
    return;
  }
  deal.stage = "丢单";
  deal.archivedAt = new Date().toISOString();
  deal.nextAction = "已标记丢单，可在归档/丢单商机中复盘";
  await store.persist();
  res.json({ deal });
}));

app.post("/api/todos/:id/complete", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const todo = store.todos.find((item) => item.id === req.params.id);
  if (!todo || !canSeePersonalData(req.user!, todo.ownerId)) {
    res.status(404).json({ message: "待办不存在" });
    return;
  }
  todo.done = true;
  todo.status = "pending";
  await store.persist();
  res.json({ todo });
}));

app.post("/api/todos/archive-due", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const scoped = store.todos.filter((todo) => canSeePersonalData(req.user!, todo.ownerId));
  const archived = archiveExpiredTodos(scoped, new Date());
  if (archived.length) await store.persist();
  res.json({ archived });
}));

app.post("/api/todos/:id/restore", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const todo = store.todos.find((item) => item.id === req.params.id);
  if (!todo || !canSeePersonalData(req.user!, todo.ownerId)) {
    res.status(404).json({ message: "待办不存在" });
    return;
  }
  todo.historyAt = "";
  todo.dueAt = currentMinuteText();
  todo.sortOrder = nextTodoSortOrder(store.todos, todo.ownerId);
  todo.pinState = "";
  if (todo.status === "in_progress" && todo.done) todo.status = "pending";
  await store.persist();
  res.json({ todo });
}));

app.patch("/api/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).optional(),
    type: z.enum(["customer", "knowledge", "exam", "ocr", "other"]).optional(),
    priority: z.enum(["high", "medium", "normal"]).optional(),
    dueAt: z.string().optional(),
    related: z.string().optional(),
    done: z.boolean().optional(),
    status: z.enum(["pending", "in_progress"]).optional(),
    pinState: z.enum(["top", "bottom", ""]).optional(),
    sortOrder: z.number().optional(),
    historyAt: z.string().optional()
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const todo = store.todos.find((item) => item.id === req.params.id);
  if (!todo || !canSeePersonalData(req.user!, todo.ownerId)) {
    res.status(404).json({ message: "待办不存在" });
    return;
  }
  if (typeof body.done === "boolean") {
    todo.done = body.done;
    if (body.done) todo.status = "pending";
  }
  if (body.status) {
    todo.status = todo.done ? "pending" : body.status;
  }
  if (body.title) todo.title = body.title;
  if (body.type) todo.type = body.type;
  if (body.priority) todo.priority = body.priority;
  if (body.dueAt !== undefined) todo.dueAt = body.dueAt;
  if (body.related !== undefined) todo.related = body.related;
  if (body.pinState !== undefined) {
    todo.pinState = body.pinState;
  }
  if (typeof body.sortOrder === "number") {
    todo.sortOrder = body.sortOrder;
  }
  if (body.historyAt !== undefined) {
    todo.historyAt = body.historyAt;
  }
  if (body.historyAt === undefined && shouldArchiveTodo(todo)) {
    todo.historyAt = new Date().toISOString();
    todo.status = "pending";
    todo.pinState = "";
  }
  await store.persist();
  res.json({ todo });
}));

app.post("/api/todos/reorder", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    ids: z.array(z.string()).min(1),
    mode: z.enum(["manual", "top", "bottom"]).default("manual"),
    targetId: z.string().optional()
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const visibleTodos = store.todos.filter((todo) => canSeePersonalData(req.user!, todo.ownerId));
  const selected = body.ids.map((id) => visibleTodos.find((todo) => todo.id === id));
  if (selected.some((todo) => !todo)) {
    res.status(404).json({ message: "待办不存在" });
    return;
  }
  selected.forEach((todo, index) => {
    if (!todo) return;
    todo.sortOrder = index + 1;
    if (body.mode === "manual") {
      todo.pinState = "";
    } else if (todo.id === body.targetId) {
      todo.pinState = body.mode;
    }
  });
  await store.persist();
  res.json({ todos: selected.filter(Boolean) });
}));

app.delete("/api/todos/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.todos.findIndex((item) => item.id === req.params.id);
  const todo = index >= 0 ? store.todos[index] : null;
  if (!todo || !canSeePersonalData(req.user!, todo.ownerId)) {
    res.status(404).json({ message: "待办不存在" });
    return;
  }
  store.todos.splice(index, 1);
  await store.persist();
  res.json({ ok: true, id: req.params.id });
}));

app.get("/api/problems", requireAuth, (req, res) => {
  const { problems } = getStore();
  const scoped = problems.filter((problem) => canSeeOwner(req.user!, problem.ownerId, problem.teamId));
  res.json({ problems: scoped });
});

app.post("/api/problems", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    category: z.string().min(1).default("客户问题"),
    severity: z.enum(["high", "medium", "low"]).default("medium"),
    status: z.enum(["open", "solving", "resolved"]).default("open"),
    relatedCustomer: z.string().default(""),
    rootCause: z.string().default(""),
    solution: z.string().default(""),
    nextAction: z.string().default(""),
    dueAt: z.string().default("")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const problem = {
    id: `p_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    createdAt: new Date().toISOString(),
    ...body
  };
  store.problems.unshift(problem);
  await store.persist();
  res.json({ problem });
}));

app.patch("/api/problems/:id/status", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ status: z.enum(["open", "solving", "resolved"]) });
  const body = schema.parse(req.body);
  const store = getStore();
  const problem = store.problems.find((item) => item.id === req.params.id);
  if (!problem || !canSeeOwner(req.user!, problem.ownerId, problem.teamId)) {
    res.status(404).json({ message: "问题不存在" });
    return;
  }
  problem.status = body.status;
  await store.persist();
  res.json({ problem });
}));

app.get("/api/memos", requireAuth, (req, res) => {
  const { memos } = getStore();
  const scoped = memos.filter((memo) => canSeePersonalData(req.user!, memo.ownerId));
  res.json({ memos: scoped });
});

app.post("/api/memos", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    content: z.string().default(""),
    category: z.string().min(1).default("客户备忘"),
    tags: z.string().default(""),
    pinned: z.boolean().default(false)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const memo = {
    id: `m_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    archived: false,
    updatedAt: new Date().toISOString(),
    ...body
  };
  store.memos.unshift(memo);
  await store.persist();
  res.json({ memo });
}));

app.patch("/api/memos/:id", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    category: z.string().min(1).optional(),
    tags: z.string().optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional()
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const memo = store.memos.find((item) => item.id === req.params.id);
  if (!memo || !canSeePersonalData(req.user!, memo.ownerId)) {
    res.status(404).json({ message: "备忘录不存在" });
    return;
  }
  if (typeof body.title === "string") memo.title = body.title;
  if (typeof body.content === "string") memo.content = body.content;
  if (typeof body.category === "string") memo.category = body.category;
  if (typeof body.tags === "string") memo.tags = body.tags;
  if (typeof body.pinned === "boolean") memo.pinned = body.pinned;
  if (typeof body.archived === "boolean") memo.archived = body.archived;
  memo.updatedAt = new Date().toISOString();
  await store.persist();
  res.json({ memo });
}));

app.delete("/api/memos/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.memos.findIndex((item) => item.id === req.params.id);
  const memo = index >= 0 ? store.memos[index] : null;
  if (!memo || !canSeePersonalData(req.user!, memo.ownerId)) {
    res.status(404).json({ message: "备忘录不存在" });
    return;
  }
  store.memos.splice(index, 1);
  await store.persist();
  res.json({ ok: true, id: req.params.id });
}));

app.get("/api/competitors", requireAuth, (req, res) => {
  const { competitors } = getStore();
  const scoped = competitors.filter((item) => canSeeOwner(req.user!, item.ownerId, item.teamId));
  res.json({ competitors: scoped });
});

app.post("/api/competitors", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    company: z.string().min(1),
    country: z.string().default(""),
    segment: z.string().default(""),
    threatLevel: z.enum(["high", "medium", "low"]).default("medium"),
    website: z.string().default(""),
    strengths: z.string().default(""),
    weaknesses: z.string().default(""),
    competingProducts: z.string().default(""),
    ourStrategy: z.string().default("")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const competitor = {
    id: `cp_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString(),
    ...body
  };
  store.competitors.unshift(competitor);
  await store.persist();
  res.json({ competitor });
}));

app.patch("/api/competitors/:id/threat", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ threatLevel: z.enum(["high", "medium", "low"]) });
  const body = schema.parse(req.body);
  const store = getStore();
  const competitor = store.competitors.find((item) => item.id === req.params.id);
  if (!competitor || !canSeeOwner(req.user!, competitor.ownerId, competitor.teamId)) {
    res.status(404).json({ message: "竞争公司不存在" });
    return;
  }
  competitor.threatLevel = body.threatLevel;
  competitor.updatedAt = new Date().toISOString();
  await store.persist();
  res.json({ competitor });
}));

app.get("/api/case-studies", requireAuth, (req, res) => {
  const { caseStudies } = getStore();
  const scoped = caseStudies.filter((item) => canSeeOwner(req.user!, item.ownerId, item.teamId));
  res.json({ caseStudies: scoped });
});

app.post("/api/case-studies", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    customer: z.string().default(""),
    country: z.string().default(""),
    product: z.string().default(""),
    industry: z.string().default(""),
    result: z.string().default(""),
    story: z.string().default(""),
    reusablePoints: z.string().default(""),
    status: z.enum(["draft", "published"]).default("draft")
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const caseStudy = {
    id: `cs_${Date.now()}`,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString(),
    ...body
  };
  store.caseStudies.unshift(caseStudy);
  await store.persist();
  res.json({ caseStudy });
}));

app.patch("/api/case-studies/:id/publish", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const caseStudy = store.caseStudies.find((item) => item.id === req.params.id);
  if (!caseStudy || !canSeeOwner(req.user!, caseStudy.ownerId, caseStudy.teamId)) {
    res.status(404).json({ message: "成功案例不存在" });
    return;
  }
  caseStudy.status = "published";
  caseStudy.updatedAt = new Date().toISOString();
  await store.persist();
  res.json({ caseStudy });
}));

app.get("/api/knowledge/assets", requireAuth, (_req, res) => {
  const { knowledgeAssets } = getStore();
  res.json({ assets: knowledgeAssets });
});

app.post("/api/knowledge/assets", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    category: z.string().min(1).default("产品知识"),
    version: z.string().min(1).default("v1")
  });
  const store = getStore();
  const body = schema.parse(req.body);
  const asset = {
    id: `k_${Date.now()}`,
    status: req.user?.role === "sales" ? "review" as const : "published" as const,
    ownerId: req.user!.id,
    ...body
  };
  store.knowledgeAssets.unshift(asset);
  await store.persist();
  res.json({ asset });
}));

app.patch("/api/knowledge/assets/:id/publish", requireAuth, asyncRoute(async (req, res) => {
  if (req.user?.role === "sales") {
    res.status(403).json({ message: "无发布资料权限" });
    return;
  }
  const store = getStore();
  const asset = store.knowledgeAssets.find((item) => item.id === req.params.id);
  if (!asset) {
    res.status(404).json({ message: "资料不存在" });
    return;
  }
  asset.status = "published";
  await store.persist();
  res.json({ asset });
}));

app.get("/api/exam-questions", requireAuth, (req, res) => {
  const category = String(req.query.category || "").trim();
  const tag = String(req.query.tag || "").trim();
  const type = String(req.query.type || "").trim();
  let questions = bankQuestions();
  if (category) questions = questions.filter((question) => question.category === category);
  if (tag) questions = questions.filter((question) => (question.tags || []).includes(tag));
  if (type) questions = questions.filter((question) => (question.questionType || (correctIndexesFor(question).length > 1 ? "multiple" : "single")) === type);
  res.json({ questions, report: examReport() });
});

app.get("/api/exam-questions/export", requireAuth, (_req, res) => {
  res.json({ questions: bankQuestions() });
});

app.post("/api/exam-questions", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const body = examQuestionSchema.parse(req.body);
  let question: ExamQuestion;
  try {
    question = buildExamQuestion(body);
  } catch (error) {
    res.status(400).json({ message: "正确答案序号超出选项数量" });
    return;
  }
  store.examQuestions.unshift(question);
  await store.persist();
  res.json({ question, report: examReport() });
}));

app.post("/api/exam-questions/import", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const schema = z.object({ questions: z.array(examQuestionSchema).min(1).max(500) });
  const body = schema.parse(req.body);
  const imported: ExamQuestion[] = [];
  for (const [index, item] of body.questions.entries()) {
    try {
      imported.push(buildExamQuestion(item, index));
    } catch (error) {
      res.status(400).json({ message: `第 ${index + 1} 行正确答案序号超出选项数量` });
      return;
    }
  }
  store.examQuestions.unshift(...imported);
  await store.persist();
  res.json({ importedCount: imported.length, questions: imported, report: examReport() });
}));

app.patch("/api/exam-questions/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.examQuestions.findIndex((question) => question.id === req.params.id);
  if (index < 0) {
    res.status(404).json({ message: "题目不存在" });
    return;
  }
  const body = examQuestionSchema.parse(req.body);
  let question: ExamQuestion;
  try {
    question = { ...buildExamQuestion(body), id: store.examQuestions[index].id, examId: store.examQuestions[index].examId || "bank" };
  } catch (error) {
    res.status(400).json({ message: "正确答案序号超出选项数量" });
    return;
  }
  store.examQuestions[index] = question;
  store.exams.forEach(refreshExamStats);
  await store.persist();
  res.json({ question, report: examReport() });
}));

app.delete("/api/exam-questions/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.examQuestions.findIndex((question) => question.id === req.params.id);
  if (index < 0) {
    res.status(404).json({ message: "题目不存在" });
    return;
  }
  const [question] = store.examQuestions.splice(index, 1);
  store.examQuestionLinks = store.examQuestionLinks.filter((link) => link.questionId !== question.id);
  store.exams.forEach(refreshExamStats);
  await store.persist();
  res.json({ question, report: examReport() });
}));

app.get("/api/exams", requireAuth, (_req, res) => {
  const { exams } = getStore();
  res.json({ exams: exams.map(examWithRuntimeStats), report: examReport() });
});

app.get("/api/exams/:id/detail", requireAuth, (req, res) => {
  const store = getStore();
  const exam = store.exams.find((item) => item.id === req.params.id);
  if (!exam) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  const questions = examQuestionsFor(exam.id);
  const attempts = store.examAttempts.filter((item) => item.examId === exam.id);
  const latestAttempt = attempts.find((item) => item.userId === req.user!.id) || null;
  res.json({ exam: examWithRuntimeStats(exam), questions, latestAttempt, report: examReport() });
});

app.post("/api/exams", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const schema = z.object({
    title: z.string().min(1),
    category: z.string().min(1),
    questionIds: z.array(z.string()).min(1, "请至少选择 1 道题目"),
    durationMinutes: z.number().int().positive().default(20),
    passScore: z.number().int().min(1).max(100).default(80),
    targetRole: z.enum(["all", "sales", "manager"]).default("sales")
  });
  const body = schema.parse(req.body);
  const uniqueQuestionIds = [...new Set(body.questionIds)];
  const selectedQuestions = uniqueQuestionIds.map((id) => store.examQuestions.find((question) => question.id === id));
  if (selectedQuestions.some((question) => !question)) {
    res.status(400).json({ message: "包含不存在的题目，请刷新题库后重试" });
    return;
  }
  const now = new Date().toISOString();
  const exam: Exam = {
    id: `e_${Date.now()}`,
    title: body.title,
    category: body.category,
    status: "scheduled",
    passRate: 0,
    questionCount: uniqueQuestionIds.length,
    durationMinutes: body.durationMinutes,
    passScore: body.passScore,
    targetRole: body.targetRole,
    updatedAt: now
  };
  store.exams.unshift(exam);
  store.examQuestionLinks.unshift(...uniqueQuestionIds.map((questionId, index) => ({ examId: exam.id, questionId, sortOrder: index + 1 })));
  refreshExamStats(exam);
  await store.persist();
  res.json({ exam: examWithRuntimeStats(exam), questions: examQuestionsFor(exam.id), report: examReport() });
}));

app.post("/api/exams/:id/questions", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const exam = store.exams.find((item) => item.id === req.params.id);
  if (!exam) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  const body = examQuestionSchema.parse({ ...req.body, category: req.body?.category || exam.category });
  let question: ExamQuestion;
  try {
    question = buildExamQuestion(body);
  } catch (error) {
    res.status(400).json({ message: "正确答案序号超出选项数量" });
    return;
  }
  store.examQuestions.unshift(question);
  store.examQuestionLinks.push({ examId: exam.id, questionId: question.id, sortOrder: examQuestionsFor(exam.id).length + 1 });
  refreshExamStats(exam);
  await store.persist();
  res.json({ question, exam: examWithRuntimeStats(exam), report: examReport() });
}));

app.post("/api/exams/:id/questions/import", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const exam = store.exams.find((item) => item.id === req.params.id);
  if (!exam) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  const schema = z.object({ questions: z.array(examQuestionSchema).min(1).max(300) });
  const body = schema.parse(req.body);
  const imported: ExamQuestion[] = [];
  for (const [index, item] of body.questions.entries()) {
    try {
      imported.push(buildExamQuestion({ ...item, category: item.category || exam.category }, index));
    } catch (error) {
      res.status(400).json({ message: `第 ${index + 1} 行正确答案序号超出选项数量` });
      return;
    }
  }
  store.examQuestions.unshift(...imported);
  store.examQuestionLinks.push(...imported.map((question, index) => ({ examId: exam.id, questionId: question.id, sortOrder: examQuestionsFor(exam.id).length + index + 1 })));
  refreshExamStats(exam);
  await store.persist();
  res.json({ importedCount: imported.length, questions: imported, exam: examWithRuntimeStats(exam), report: examReport() });
}));

app.patch("/api/exams/:id/publish", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const exam = store.exams.find((item) => item.id === req.params.id);
  if (!exam) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  if (!examQuestionsFor(exam.id).length) {
    res.status(400).json({ message: "请先勾选至少 1 道题目组卷" });
    return;
  }
  exam.status = "published";
  refreshExamStats(exam);
  await store.persist();
  res.json({ exam: examWithRuntimeStats(exam), report: examReport() });
}));

app.post("/api/exams/bulk-delete", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const schema = z.object({ ids: z.array(z.string()).min(1).max(100) });
  const body = schema.parse(req.body);
  const ids = [...new Set(body.ids)];
  const deleted = store.exams.filter((exam) => ids.includes(exam.id));
  if (!deleted.length) {
    res.status(404).json({ message: "未找到可删除的考试" });
    return;
  }
  const deletedIds = new Set(deleted.map((exam) => exam.id));
  store.exams = store.exams.filter((exam) => !deletedIds.has(exam.id));
  store.examQuestionLinks = store.examQuestionLinks.filter((link) => !deletedIds.has(link.examId));
  store.examAttempts = store.examAttempts.filter((attempt) => !deletedIds.has(attempt.examId));
  store.exams.forEach(refreshExamStats);
  await store.persist();
  res.json({ deleted, exams: store.exams.map(examWithRuntimeStats), report: examReport() });
}));

app.delete("/api/exams/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.exams.findIndex((item) => item.id === req.params.id);
  if (index < 0) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  const [exam] = store.exams.splice(index, 1);
  store.examQuestionLinks = store.examQuestionLinks.filter((link) => link.examId !== exam.id);
  store.examAttempts = store.examAttempts.filter((attempt) => attempt.examId !== exam.id);
  store.exams.forEach(refreshExamStats);
  await store.persist();
  res.json({ exam, exams: store.exams.map(examWithRuntimeStats), report: examReport() });
}));

app.post("/api/exams/:id/submit", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const exam = store.exams.find((item) => item.id === req.params.id);
  if (!exam) {
    res.status(404).json({ message: "考试不存在" });
    return;
  }
  const schema = z.object({
    answers: z.record(z.string(), z.union([z.number().int().nonnegative(), z.array(z.number().int().nonnegative())])).optional(),
    score: z.number().min(0).max(100).optional()
  });
  const body = schema.parse(req.body);
  const questions = examQuestionsFor(exam.id);
  if (!questions.length) {
    res.status(400).json({ message: "当前考试暂无题目" });
    return;
  }
  const answers = body.answers || {};
  const correctCount = questions.filter((question) => {
    const rawAnswer = answers[question.id];
    const selectedIndexes = Array.isArray(rawAnswer) ? rawAnswer : rawAnswer == null ? [] : [rawAnswer];
    return indexesEqual(selectedIndexes, correctIndexesFor(question));
  }).length;
  const score = body.score == null ? Math.round((correctCount / questions.length) * 100) : Math.round(body.score);
  const attempt: ExamAttempt = {
    id: `attempt_${exam.id}_${req.user!.id}_${Date.now()}`,
    examId: exam.id,
    userId: req.user!.id,
    score,
    passed: score >= (exam.passScore || 80),
    answers,
    correctCount: body.score == null ? correctCount : Math.round((score / 100) * questions.length),
    totalQuestions: questions.length,
    submittedAt: new Date().toISOString()
  };
  store.examAttempts.unshift(attempt);
  refreshExamStats(exam);
  await store.persist();
  res.json({ attempt, exam: examWithRuntimeStats(exam), questions, report: examReport() });
}));

app.get("/api/reminders", requireAuth, (req, res) => {
  const { reminders } = getStore();
  const scoped = reminders.filter((reminder) => canSeeOwner(req.user!, reminder.ownerId, reminder.teamId));
  res.json({ reminders: scoped });
});

app.post("/api/reminders", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).optional(),
    rule: z.string().min(1).optional(),
    dueAt: z.string().min(1).default("今天 17:00"),
    channel: z.enum(["站内", "邮件", "企业微信"]).default("企业微信"),
    ruleType: z.enum(["quote_no_reply", "sample_feedback", "inactive_customer", "high_value_revisit", "custom_due"]).default("quote_no_reply"),
    targetStage: z.string().default("已报价"),
    days: z.number().int().min(0).max(90).default(3),
    priority: z.enum(["high", "medium", "normal"]).default("medium"),
    enabled: z.boolean().default(true)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const generatedCount = matchReminderRule(req.user!, body).length;
  const reminder = {
    id: `r_${Date.now()}`,
    title: body.title || reminderRuleTitle(body.ruleType),
    rule: body.rule || reminderRuleText(body),
    dueAt: body.dueAt,
    channel: body.channel,
    ruleType: body.ruleType,
    targetStage: body.targetStage,
    days: body.days,
    priority: body.priority,
    enabled: body.enabled,
    generatedCount,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    status: "pending" as const
  };
  store.reminders.unshift(reminder);
  await store.persist();
  res.json({ reminder });
}));

app.post("/api/reminders/:id/run", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const reminder = store.reminders.find((item) => item.id === req.params.id);
  if (!reminder || !canSeeOwner(req.user!, reminder.ownerId, reminder.teamId)) {
    res.status(404).json({ message: "提醒规则不存在" });
    return;
  }
  if (reminder.enabled === false) {
    res.status(400).json({ message: "提醒规则已停用" });
    return;
  }
  const matched = matchReminderRule(req.user!, reminder);
  const created: Todo[] = [];
  for (const customer of matched) {
    const exists = store.todos.some((todo) => todo.ownerId === req.user!.id && !todo.done && todo.related === customer.company && todo.title.includes(reminder.title));
    if (exists) continue;
    created.push({
      id: `t_reminder_${reminder.id}_${customer.id}_${Date.now()}`,
      title: `${reminder.title}：${customer.company}`,
      type: "customer",
      priority: reminder.priority || "medium",
      status: "pending",
      pinState: "",
      sortOrder: nextTodoSortOrder(store.todos, req.user!.id),
      dueAt: reminder.dueAt || currentMinuteText(),
      ownerId: req.user!.id,
      teamId: req.user!.teamId,
      related: customer.company,
      done: false,
      impactAmount: customer.amount,
      createdAt: new Date().toISOString()
    });
  }
  store.todos.unshift(...created);
  reminder.generatedCount = matched.length;
  if (created.length) reminder.status = "sent";
  await store.persist();
  res.json({ reminder, createdCount: created.length, matchedCount: matched.length, todos: created });
}));

app.post("/api/reminders/:id/done", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const reminder = store.reminders.find((item) => item.id === req.params.id);
  if (!reminder || !canSeeOwner(req.user!, reminder.ownerId, reminder.teamId)) {
    res.status(404).json({ message: "提醒不存在" });
    return;
  }
  reminder.status = "done";
  await store.persist();
  res.json({ reminder });
}));

app.get("/api/import-export/jobs", requireAuth, (req, res) => {
  const { importExportJobs } = getStore();
  const scoped = req.user?.role === "sales"
    ? importExportJobs.filter((job) => job.operatorId === req.user?.id)
    : importExportJobs;
  res.json({ jobs: scoped });
});

app.post("/api/import-export/jobs", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), type: z.enum(["import", "export"]), rows: z.number().int().nonnegative() });
  const store = getStore();
  const body = schema.parse(req.body);
  const job = { id: `io_${Date.now()}`, status: body.type === "export" ? "review" as const : "done" as const, operatorId: req.user!.id, createdAt: "刚刚", ...body };
  store.importExportJobs.unshift(job);
  await store.persist();
  res.json({ job });
}));

app.post("/api/import-export/customers/import", requireAuth, asyncRoute(async (req, res) => {
  const rowSchema = z.object({
    company: z.string().trim().min(1),
    country: z.string().trim().optional().default("未知"),
    contact: z.string().trim().optional().default("待维护"),
    stage: z.string().trim().optional().default("询盘"),
    amount: z.number().nonnegative().optional().default(0),
    health: z.number().int().min(0).max(100).optional().default(70),
    nextReminder: z.string().trim().optional().default("待跟进"),
    wecomBound: z.boolean().optional().default(false),
    billingName: z.string().trim().optional().default(""),
    billingAddress: z.string().trim().optional().default(""),
    documentContact: z.string().trim().optional().default(""),
    defaultPortDischarge: z.string().trim().optional().default(""),
    defaultIncoterm: z.string().trim().optional().default("FOB Tianjin"),
    defaultPaymentTerm: z.string().trim().optional().default("30% T/T deposit, 70% before shipment")
  });
  const schema = z.object({ rows: z.array(rowSchema).min(1).max(2000), fileName: z.string().optional().default("客户导入") });
  const body = schema.parse(req.body);
  const store = getStore();
  const scopedCustomers = store.customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  let created = 0;
  let updated = 0;
  const imported: Customer[] = [];
  for (const row of body.rows) {
    const existing = scopedCustomers.find((customer) => customer.company.trim().toLowerCase() === row.company.trim().toLowerCase());
    if (existing) {
      Object.assign(existing, {
        country: row.country || existing.country,
        contact: row.contact || existing.contact,
        stage: row.stage || existing.stage,
        amount: row.amount,
        health: row.health,
        nextReminder: row.nextReminder || existing.nextReminder,
        wecomBound: row.wecomBound,
        billingName: row.billingName || existing.billingName || row.company,
        billingAddress: row.billingAddress || existing.billingAddress || "",
        documentContact: row.documentContact || existing.documentContact || row.contact,
        defaultPortDischarge: row.defaultPortDischarge || existing.defaultPortDischarge || "",
        defaultIncoterm: row.defaultIncoterm || existing.defaultIncoterm || "FOB Tianjin",
        defaultPaymentTerm: row.defaultPaymentTerm || existing.defaultPaymentTerm || "30% T/T deposit, 70% before shipment"
      });
      imported.push(existing);
      updated += 1;
    } else {
      const customer: Customer = {
        id: `c_import_${Date.now()}_${created}_${Math.random().toString(16).slice(2, 8)}`,
        company: row.company,
        country: row.country || "未知",
        contact: row.contact || "待维护",
        ownerId: req.user!.id,
        teamId: req.user!.teamId,
        stage: row.stage || "询盘",
        amount: row.amount,
        health: row.health,
        nextReminder: row.nextReminder || "待跟进",
        wecomBound: row.wecomBound,
        billingName: row.billingName || row.company,
        billingAddress: row.billingAddress || "",
        documentContact: row.documentContact || row.contact || "待维护",
        defaultPortDischarge: row.defaultPortDischarge || "",
        defaultIncoterm: row.defaultIncoterm || "FOB Tianjin",
        defaultPaymentTerm: row.defaultPaymentTerm || "30% T/T deposit, 70% before shipment"
      };
      store.customers.unshift(customer);
      scopedCustomers.push(customer);
      imported.push(customer);
      created += 1;
    }
  }
  const job = {
    id: `io_customer_import_${Date.now()}`,
    name: `客户导入：${body.fileName}`,
    type: "import" as const,
    rows: body.rows.length,
    status: "done" as const,
    operatorId: req.user!.id,
    createdAt: currentMinuteText()
  };
  store.importExportJobs.unshift(job);
  await store.persist();
  const customers = store.customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  res.json({ result: { created, updated, skipped: 0, total: body.rows.length }, job, customers, imported });
}));

app.post("/api/import-export/customers/export", requireAuth, asyncRoute(async (_req, res) => {
  const store = getStore();
  const customers = store.customers.filter((customer) => canSeeOwner(_req.user!, customer.ownerId, customer.teamId));
  const job = {
    id: `io_customer_export_${Date.now()}`,
    name: "客户清单导出",
    type: "export" as const,
    rows: customers.length,
    status: "done" as const,
    operatorId: _req.user!.id,
    createdAt: currentMinuteText()
  };
  store.importExportJobs.unshift(job);
  await store.persist();
  res.json({ customers, job });
}));

const documentItemSchema = z.object({
  id: z.string().optional().default(""),
  product: z.string().min(1),
  model: z.string().optional().default(""),
  hsCode: z.string().optional().default(""),
  quantity: z.number().nonnegative().default(1),
  unit: z.string().optional().default("PCS"),
  unitPrice: z.number().nonnegative().default(0),
  originCountry: z.string().optional().default("China"),
  weightKg: z.number().nonnegative().default(0),
  packageCount: z.number().int().nonnegative().default(0)
});

const documentBodySchema = z.object({
  type: z.enum(["PI", "CI"]).default("PI"),
  title: z.string().min(1),
  number: z.string().min(1),
  issueDate: z.string().min(1),
  buyer: z.string().min(1),
  buyerAddress: z.string().optional().default(""),
  buyerContact: z.string().optional().default(""),
  seller: z.string().min(1),
  sellerAddress: z.string().optional().default(""),
  currency: z.string().min(1).default("USD"),
  incoterm: z.string().min(1).default("FOB"),
  paymentTerm: z.string().optional().default("30% T/T deposit, 70% before shipment"),
  shippingMethod: z.string().optional().default("Sea freight"),
  portLoading: z.string().optional().default("Tianjin, China"),
  portDischarge: z.string().optional().default(""),
  validityDate: z.string().optional().default(""),
  bankInfo: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  templateStyle: z.enum(["executive", "classic", "compact"]).default("executive"),
  status: z.enum(["draft", "ready", "exported"]).optional().default("draft"),
  items: z.array(documentItemSchema).min(1).max(80)
});

function normalizeDocument(body: z.infer<typeof documentBodySchema>, user: SessionUser, existing?: TradeDocument): TradeDocument {
  return {
    id: existing?.id || `td_${Date.now()}`,
    ownerId: existing?.ownerId || user.id,
    teamId: existing?.teamId || user.teamId,
    updatedAt: new Date().toISOString(),
    ...body,
    items: body.items.map((item, index) => ({ ...item, id: item.id || `tdi_${Date.now()}_${index}` }))
  };
}

app.get("/api/trade-documents", requireAuth, (req, res) => {
  const { tradeDocuments } = getStore();
  const documents = tradeDocuments.filter((document) => canSeeOwner(req.user!, document.ownerId, document.teamId));
  res.json({ documents });
});

app.post("/api/trade-documents", requireAuth, asyncRoute(async (req, res) => {
  const body = documentBodySchema.parse(req.body);
  const store = getStore();
  const document = normalizeDocument(body, req.user!);
  store.tradeDocuments.unshift(document);
  await store.persist();
  res.json({ document });
}));

app.patch("/api/trade-documents/:id", requireAuth, asyncRoute(async (req, res) => {
  const body = documentBodySchema.parse(req.body);
  const store = getStore();
  const index = store.tradeDocuments.findIndex((document) => document.id === req.params.id);
  const existing = index >= 0 ? store.tradeDocuments[index] : undefined;
  if (!existing || !canSeeOwner(req.user!, existing.ownerId, existing.teamId)) {
    res.status(404).json({ message: "单据不存在" });
    return;
  }
  const document = normalizeDocument(body, req.user!, existing);
  store.tradeDocuments[index] = document;
  await store.persist();
  res.json({ document });
}));

app.post("/api/trade-documents/:id/export", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const document = store.tradeDocuments.find((item) => item.id === req.params.id);
  if (!document || !canSeeOwner(req.user!, document.ownerId, document.teamId)) {
    res.status(404).json({ message: "单据不存在" });
    return;
  }
  document.status = "exported";
  document.updatedAt = new Date().toISOString();
  const job = {
    id: `io_document_export_${Date.now()}`,
    name: `${document.type} 单据 PDF 导出：${document.number}`,
    type: "export" as const,
    rows: document.items.length,
    status: "done" as const,
    operatorId: req.user!.id,
    createdAt: currentMinuteText()
  };
  store.importExportJobs.unshift(job);
  await store.persist();
  res.json({ document, job, fileName: `${document.number}-${document.type}.pdf` });
}));

app.get("/api/wecom/messages", requireAuth, (req, res) => {
  const { wecomMessages } = getStore();
  const scoped = wecomMessages.filter((message) => canSeeOwner(req.user!, message.ownerId, message.teamId));
  res.json({ messages: scoped });
});

app.post("/api/wecom/messages/:id/archive", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const message = store.wecomMessages.find((item) => item.id === req.params.id);
  if (!message || !canSeeOwner(req.user!, message.ownerId, message.teamId)) {
    res.status(404).json({ message: "企微摘要不存在" });
    return;
  }
  message.status = "archived";
  await store.persist();
  res.json({ message });
}));

app.get("/api/tools/ocr/jobs/:id", requireAuth, (req, res) => {
  const job = getStore().ocrJobs.find((item) => item.id === req.params.id);
  if (!job) {
    res.status(404).json({ message: "OCR 任务不存在" });
    return;
  }
  res.json({ job });
});

app.post("/api/tools/ocr/jobs/:id/recognize", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const job = store.ocrJobs.find((item) => item.id === req.params.id);
  if (!job) {
    res.status(404).json({ message: "OCR 任务不存在" });
    return;
  }
  job.status = "recognized";
  job.confidence = Number(req.body?.confidence ?? 96);
  job.fields = {
    ...job.fields,
    company: req.body?.company || job.fields.company || "NorthStar Lighting GmbH",
    contact: req.body?.contact || job.fields.contact || "James Müller",
    email: req.body?.email || job.fields.email || "james.mueller@northstar-light.de",
    whatsapp: req.body?.whatsapp || job.fields.whatsapp || "+49 151 2388 9012",
    wechat: req.body?.wechat || job.fields.wechat || "james_light_de",
    phone: req.body?.phone || job.fields.phone || "+49 30 8842 1290",
    country: req.body?.country || job.fields.country || "德国"
  };
  await store.persist();
  res.json({ job });
}));

app.post("/api/tools/ocr/jobs/:id/sync-lead", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const job = store.ocrJobs.find((item) => item.id === req.params.id);
  if (!job) {
    res.status(404).json({ message: "OCR 任务不存在" });
    return;
  }
  job.status = "synced";
  const lead = {
    id: `lead_${job.id}`,
    source: "名片 OCR",
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    ...job.fields
  };
  await store.persist();
  res.json({ lead });
}));

app.get("/api/tools/website-opportunities", requireAuth, (req, res) => {
  const { websiteOpportunities } = getStore();
  const scoped = websiteOpportunities.filter((item) => canSeeOwner(req.user!, item.ownerId, item.teamId));
  res.json({ opportunities: scoped });
});

app.get("/api/tools/ai-config", requireAuth, (req, res) => {
  const configs = getAiConfigs(req.user!);
  const config = getAiConfig(req.user!);
  res.json({ config: config ? publicAiConfig(config) : null, configs: configs.map(publicAiConfig) });
});

app.post("/api/tools/ai-config", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    id: z.string().min(1).max(64).optional(),
    provider: z.string().min(1).max(40).default("openai"),
    protocol: z.enum(["openai-compatible", "anthropic", "gemini"]).default("openai-compatible"),
    name: z.string().min(1).default("AI业务模型配置"),
    baseUrl: z.string().url(),
    model: z.string().min(1),
    apiKey: z.string().optional().default(""),
    enabled: z.boolean().default(false),
    temperature: z.number().min(0).max(2).default(0.1),
    useLeadFinder: z.boolean().default(true),
    useWebsiteParse: z.boolean().default(true),
    useScoring: z.boolean().default(true),
    useEmailDraft: z.boolean().default(true),
    useExam: z.boolean().default(false)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const existing = body.id ? store.aiModelConfigs.find((item) => item.id === body.id && item.ownerId === req.user!.id) : undefined;
  const apiKey = body.apiKey && !body.apiKey.includes("****") ? body.apiKey : existing?.apiKey || "";
  if (body.enabled && !apiKey) {
    res.status(400).json({ message: "启用配置前必须填写 API Key" });
    return;
  }
  const config: AiModelConfig = {
    id: existing?.id || body.id || `ai_${req.user!.id}_${Date.now()}`,
    provider: body.provider,
    protocol: body.protocol,
    name: body.name,
    baseUrl: body.baseUrl.replace(/\/+$/, ""),
    model: body.model,
    apiKey,
    enabled: body.enabled,
    temperature: body.temperature,
    useLeadFinder: body.useLeadFinder,
    useWebsiteParse: body.useWebsiteParse,
    useScoring: body.useScoring,
    useEmailDraft: body.useEmailDraft,
    useExam: body.useExam,
    lastTestAt: existing?.lastTestAt,
    lastTestStatus: existing?.lastTestStatus || "untested",
    lastTestMessage: existing?.lastTestMessage || "",
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, config);
  else store.aiModelConfigs.unshift(config);
  await syncAiSiteSettingFromAiConfig(config, req.user!);
  await store.persist();
  res.json({ config: publicAiConfig(config), configs: getAiConfigs(req.user!).map(publicAiConfig) });
}));

app.delete("/api/tools/ai-config/:id", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.aiModelConfigs.findIndex((item) => item.id === req.params.id && item.ownerId === req.user!.id);
  if (index < 0) {
    res.status(404).json({ message: "配置不存在或无权删除" });
    return;
  }
  store.aiModelConfigs.splice(index, 1);
  const fallback = getAiConfig(req.user!);
  if (fallback) await syncAiSiteSettingFromAiConfig(fallback, req.user!);
  await store.persist();
  const config = getAiConfig(req.user!);
  res.json({ config: config ? publicAiConfig(config) : null, configs: getAiConfigs(req.user!).map(publicAiConfig) });
}));

app.post("/api/tools/ai-config/test", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ id: z.string().min(1).max(64).optional() });
  const body = schema.parse(req.body || {});
  const config = body.id
    ? getStore().aiModelConfigs.find((item) => item.id === body.id && item.ownerId === req.user!.id) || null
    : getAiConfig(req.user!);
  if (!config || !config.baseUrl || !config.model) {
    res.status(400).json({ message: "请先保存模型地址和模型名称" });
    return;
  }
  if (!config.apiKey) {
    res.status(400).json({ message: "请先填写 API Key；系统不会在页面明文回显密钥" });
    return;
  }
  const result = await testAiConfig(config);
  config.lastTestAt = new Date().toISOString();
  config.lastTestStatus = result.ok ? "passed" : "failed";
  config.lastTestMessage = result.message;
  config.updatedAt = new Date().toISOString();
  await syncAiSiteSettingFromAiConfig(config, req.user!);
  await getStore().persist();
  res.json({ ok: result.ok, message: result.message, config: publicAiConfig(config), configs: getAiConfigs(req.user!).map(publicAiConfig) });
}));

const leadFinderSearchSchema = z.object({
  productKeywords: z.string().default(""),
  countries: z.string().default(""),
  industry: z.string().default(""),
  customerType: z.string().default(""),
  goal: z.string().default(""),
  limit: z.number().min(1).max(30).default(10)
});

app.post("/api/lead-finder/free-search", requireAuth, asyncRoute(async (req, res) => {
  const body = leadFinderSearchSchema.parse(req.body);
  const store = getStore();
  const limit = Math.min(body.limit, 12);
  const [gleif, wikidata] = await Promise.all([
    searchGleifLeads(body, req.user!, Math.ceil(limit / 2)),
    searchWikidataLeads(body, req.user!, Math.ceil(limit / 2))
  ]);
  const merged: WebsiteOpportunity[] = [];
  for (const item of [...gleif, ...wikidata]) {
    if (merged.some((row) => row.company.toLowerCase() === item.company.toLowerCase() || row.website === item.website)) continue;
    merged.push(item);
  }
  for (const item of merged) {
    const existing = store.websiteOpportunities.find((row) => row.ownerId === req.user!.id && (row.website === item.website || row.company.toLowerCase() === item.company.toLowerCase()));
    if (existing) Object.assign(existing, item, { id: existing.id, status: existing.status, customerId: existing.customerId, dealId: existing.dealId });
    else store.websiteOpportunities.unshift(item);
  }
  await store.persist();
  res.json({ opportunities: merged, sources: { gleif: gleif.length, wikidata: wikidata.length } });
}));

// ---------------------------------------------------------------------------
// 自动获客 · 数据源中心（Provider 注册表 + 用户 Key 配置 + 统一搜索）
// ---------------------------------------------------------------------------

function getLeadSourceConfig(user: SessionUser, provider: string): LeadSourceConfig | undefined {
  return getStore().leadSourceConfigs.find((item) => item.provider === provider && item.ownerId === user.id);
}

function publicLeadSourceConfig(config: LeadSourceConfig) {
  return {
    id: config.id,
    provider: config.provider,
    scope: config.scope,
    apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : "",
    hasApiKey: Boolean(config.apiKey),
    baseUrl: config.baseUrl || "",
    enabled: config.enabled,
    lastTestAt: config.lastTestAt || "",
    lastTestStatus: config.lastTestStatus || "untested",
    lastTestMessage: config.lastTestMessage || "",
    usage: config.usageJson || "",
    updatedAt: config.updatedAt
  };
}

function providerStatusFor(user: SessionUser, provider: LeadProvider) {
  const config = getLeadSourceConfig(user, provider.id);
  const hasKey = !provider.requiresKey || Boolean(config?.apiKey);
  const enabled = provider.requiresKey ? Boolean(config?.enabled && config?.apiKey) : config ? config.enabled : true;
  return {
    ...providerMeta(provider),
    hasApiKey: Boolean(config?.apiKey),
    ready: hasKey,
    enabled,
    lastTestStatus: config?.lastTestStatus || (provider.requiresKey ? "untested" : "passed"),
    lastTestMessage: config?.lastTestMessage || "",
    lastTestAt: config?.lastTestAt || "",
    usage: config?.usageJson || ""
  };
}

// AI 搜索作为一种数据源：不需要独立 API Key，直接复用「AI 模型配置」里已启用且勾选自动获客的模型
function aiSearchStatus(user: SessionUser) {
  const config = getAiConfig(user, "leadFinder");
  const ready = Boolean(config?.enabled && config?.apiKey && config?.useLeadFinder);
  return {
    id: "ai_search",
    name: "AI 搜索",
    tier: "ai" as const,
    category: "ai" as const,
    requiresKey: false,
    capabilities: ["ai", "company"],
    docsUrl: "",
    keyHint: "使用「AI 模型配置」中已启用并勾选自动获客的模型，无需在此另填 Key。",
    defaultBaseUrl: "",
    costNote: "调用你配置的 AI 模型直接生成候选公司，结果需人工核实。",
    hasApiKey: ready,
    ready,
    enabled: ready,
    lastTestStatus: ready ? "passed" : "untested",
    lastTestMessage: ready ? `当前模型：${config?.model || "已配置"}` : "请先在「AI 模型配置」启用模型并勾选“自动获客”",
    lastTestAt: config?.lastTestAt || "",
    usage: ""
  };
}

function allProviderStatuses(user: SessionUser) {
  return [aiSearchStatus(user), ...LEAD_PROVIDERS.map((provider) => providerStatusFor(user, provider))];
}

app.get("/api/lead-finder/providers", requireAuth, (req, res) => {
  res.json({ providers: allProviderStatuses(req.user!) });
});

app.post("/api/lead-finder/source-config", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    provider: z.string().min(1).max(40),
    apiKey: z.string().max(400).optional().default(""),
    baseUrl: z.string().max(255).optional().default(""),
    enabled: z.boolean().optional().default(false)
  });
  const body = schema.parse(req.body);
  const provider = getProvider(body.provider);
  if (!provider) {
    res.status(404).json({ message: "未知数据源" });
    return;
  }
  const store = getStore();
  const existing = getLeadSourceConfig(req.user!, body.provider);
  const apiKey = body.apiKey && !body.apiKey.includes("****") ? body.apiKey : existing?.apiKey || "";
  if (provider.requiresKey && body.enabled && !apiKey) {
    res.status(400).json({ message: "启用前请先填写该数据源的 API Key" });
    return;
  }
  const config: LeadSourceConfig = {
    id: existing?.id || `ls_${provider.id}_${req.user!.id}_${Date.now()}`,
    provider: provider.id,
    scope: "personal",
    apiKey,
    baseUrl: body.baseUrl || existing?.baseUrl || "",
    enabled: body.enabled,
    lastTestAt: existing?.lastTestAt,
    lastTestStatus: existing?.lastTestStatus || "untested",
    lastTestMessage: existing?.lastTestMessage || "",
    usageJson: existing?.usageJson,
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, config);
  else store.leadSourceConfigs.unshift(config);
  await store.persist();
  res.json({ config: publicLeadSourceConfig(config), providers: allProviderStatuses(req.user!) });
}));

app.post("/api/lead-finder/source-config/test", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ provider: z.string().min(1).max(40) });
  const body = schema.parse(req.body);
  const provider = getProvider(body.provider);
  if (!provider) {
    res.status(404).json({ message: "未知数据源" });
    return;
  }
  const store = getStore();
  const config = getLeadSourceConfig(req.user!, provider.id);
  if (provider.requiresKey && !config?.apiKey) {
    res.status(400).json({ message: "请先保存该数据源的 API Key，再测试连接" });
    return;
  }
  let result;
  try {
    result = await provider.test({ apiKey: config?.apiKey || "", baseUrl: config?.baseUrl });
  } catch (error) {
    result = { ok: false, message: `连接异常：${error instanceof Error ? error.message : "未知错误"}` };
  }
  if (config) {
    config.lastTestAt = new Date().toISOString();
    config.lastTestStatus = result.ok ? "passed" : "failed";
    config.lastTestMessage = result.message;
    if (result.usage) config.usageJson = result.usage;
    config.updatedAt = new Date().toISOString();
    await store.persist();
  }
  res.json({ ok: result.ok, message: result.message, usage: result.usage || "", providers: allProviderStatuses(req.user!) });
}));

app.delete("/api/lead-finder/source-config/:provider", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const index = store.leadSourceConfigs.findIndex((item) => item.provider === req.params.provider && item.ownerId === req.user!.id);
  if (index < 0) {
    res.status(404).json({ message: "配置不存在或无权删除" });
    return;
  }
  store.leadSourceConfigs.splice(index, 1);
  await store.persist();
  res.json({ providers: allProviderStatuses(req.user!) });
}));

const leadSearchSchema = z.object({
  goal: z.string().default(""),
  productKeywords: z.string().default(""),
  countries: z.string().default(""),
  industry: z.string().default(""),
  customerType: z.string().default(""),
  excludeKeywords: z.string().default(""),
  sources: z.array(z.string()).default([]),
  useAi: z.boolean().default(false),
  limit: z.number().min(1).max(30).default(12)
});

app.post("/api/lead-finder/search", requireAuth, asyncRoute(async (req, res) => {
  const body = leadSearchSchema.parse(req.body);
  const store = getStore();
  const user = req.user!;
  const query: LeadQuery = {
    goal: body.goal,
    productKeywords: body.productKeywords,
    countries: body.countries,
    industry: body.industry,
    customerType: body.customerType,
    excludeKeywords: body.excludeKeywords,
    limit: Math.min(body.limit, 15)
  };

  // 选中源 ∩ 已启用 ∩ (有 key)。免费源无 key 也可用；未选中时默认用免费源兜底。
  const chosen = body.sources.length
    ? LEAD_PROVIDERS.filter((provider) => body.sources.includes(provider.id))
    : LEAD_PROVIDERS.filter((provider) => !provider.requiresKey);
  const runnable = chosen.filter((provider) => {
    if (!provider.requiresKey) return true;
    const config = getLeadSourceConfig(user, provider.id);
    return Boolean(config?.apiKey && config.enabled);
  });
  const skipped = chosen.filter((provider) => !runnable.includes(provider)).map((provider) => provider.name);
  // 用户明确选了源（哪怕只选 AI 搜索）就不再兜底跑免费源；完全没选时才用免费源兜底
  const activeProviders = runnable.length ? runnable : (body.sources.length ? [] : LEAD_PROVIDERS.filter((provider) => !provider.requiresKey));
  const wantsAiSearch = body.sources.includes("ai_search");

  const searchProviders = activeProviders.filter((provider) => provider.category !== "email");
  const emailProviders = activeProviders.filter((provider) => provider.category === "email" && provider.enrich);

  const sourceStats: Array<{ id: string; name: string; count: number; error?: string; usage?: string }> = [];
  const collected: Array<RawLead & { source: string; sourceLabel: string }> = [];

  await Promise.all(searchProviders.map(async (provider) => {
    const config = getLeadSourceConfig(user, provider.id);
    try {
      const result = await provider.search(query, { apiKey: config?.apiKey || "", baseUrl: config?.baseUrl });
      for (const lead of result.leads) {
        if (!lead.company) continue;
        collected.push({ ...lead, source: provider.id, sourceLabel: provider.name });
      }
      sourceStats.push({ id: provider.id, name: provider.name, count: result.leads.length, usage: result.usage });
    } catch (error) {
      sourceStats.push({ id: provider.id, name: provider.name, count: 0, error: error instanceof Error ? error.message : "调用失败" });
    }
  }));

  // AI 搜索：用「AI 模型配置」里已启用并勾选自动获客的模型直接生成候选公司
  if (wantsAiSearch) {
    const aiSearchConfig = getAiConfig(user, "leadFinder");
    if (aiSearchConfig?.enabled && aiSearchConfig.apiKey && aiSearchConfig.useLeadFinder) {
      try {
        const aiLeads = await aiGenerateLeads(query, aiSearchConfig);
        for (const lead of aiLeads) {
          if (!lead.company) continue;
          collected.push({ ...lead, source: "ai_search", sourceLabel: "AI 搜索" });
        }
        sourceStats.push({ id: "ai_search", name: "AI 搜索", count: aiLeads.length });
      } catch (error) {
        sourceStats.push({ id: "ai_search", name: "AI 搜索", count: 0, error: error instanceof Error ? error.message : "AI 调用失败" });
      }
    } else {
      skipped.push("AI 搜索（未启用模型）");
    }
  }

  // 去重（域名 + 公司名）
  const deduped: Array<RawLead & { source: string; sourceLabel: string }> = [];
  for (const lead of collected) {
    const domain = websiteDomainKey(lead.website || "");
    const key = domain || lead.company.toLowerCase();
    if (deduped.some((row) => (domain && websiteDomainKey(row.website || "") === domain) || row.company.toLowerCase() === lead.company.toLowerCase())) continue;
    deduped.push(lead);
  }

  // Web 源结果做官网解析补全（best-effort，限量控制耗时）
  const aiConfig = body.useAi ? getAiConfig(user, "websiteParse") : null;
  const parseTargets = deduped.filter((lead) => ["serper", "brave", "serpapi", "ai_search"].includes(lead.source) && lead.website).slice(0, 6);
  await Promise.all(parseTargets.map(async (lead) => {
    try {
      const parsed = await parseWebsiteOpportunity(lead.website!, 0, user, aiConfig);
      if (parsed.company && !/unknown/i.test(parsed.company)) lead.company = parsed.company;
      if (parsed.business && parsed.business !== "待维护") lead.business = parsed.business;
      if (parsed.country && parsed.country !== "未知") lead.country = parsed.country;
      if (parsed.contact && parsed.contact !== "待维护") lead.contact = parsed.contact;
      if (parsed.contactInfo && parsed.contactInfo !== "待维护") lead.contactInfo = parsed.contactInfo;
      if (parsed.description) lead.description = parsed.description;
      if (parsed.parseMode === "ai") lead.confidence = Math.max(lead.confidence || 60, 74);
    } catch {
      // 解析失败保留搜索摘要
    }
  }));

  // 邮箱源补全（Hunter 等）：对缺联系方式且有域名的候选补邮箱
  for (const provider of emailProviders) {
    const config = getLeadSourceConfig(user, provider.id);
    const targets = deduped.filter((lead) => !lead.contactInfo && websiteDomainKey(lead.website || "")).slice(0, 8);
    let filled = 0;
    for (const lead of targets) {
      const enriched = await provider.enrich!(websiteDomainKey(lead.website || ""), { apiKey: config?.apiKey || "", baseUrl: config?.baseUrl });
      if (enriched?.contactInfo) {
        lead.contactInfo = enriched.contactInfo;
        if (enriched.contact) lead.contact = enriched.contact;
        lead.confidence = Math.max(lead.confidence || 60, 74);
        filled += 1;
      }
    }
    sourceStats.push({ id: provider.id, name: provider.name, count: filled });
  }

  // 落库为 WebsiteOpportunity
  const now = Date.now();
  const opportunities: WebsiteOpportunity[] = deduped.slice(0, query.limit * 2).map((lead, index) => ({
    id: `lf_${lead.source}_${now}_${index}`,
    company: lead.company,
    business: lead.business || "待维护",
    country: lead.country || "未知",
    website: normalizeWebsite(lead.website || ""),
    contact: lead.contact || "待维护",
    contactInfo: lead.contactInfo || "",
    description: lead.description || "自动获客候选，待核实。",
    ownerId: user.id,
    teamId: user.teamId,
    status: "preview",
    createdAt: new Date().toISOString(),
    parseMode: aiConfig ? "ai" : "rule",
    source: lead.source,
    sourceLabel: lead.sourceLabel,
    confidence: lead.confidence
  }));

  for (const item of opportunities) {
    const existing = store.websiteOpportunities.find((row) => row.ownerId === user.id && (row.website === item.website || row.company.toLowerCase() === item.company.toLowerCase()));
    if (existing) Object.assign(existing, item, { id: existing.id, status: existing.status, customerId: existing.customerId, dealId: existing.dealId });
    else store.websiteOpportunities.unshift(item);
  }
  await store.persist();
  res.json({ opportunities, sourceStats, skipped, providersUsed: activeProviders.map((provider) => provider.id) });
}));

function websiteDomainKey(raw: string) {
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

app.post("/api/tools/website-scrape/preview", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({ urls: z.array(z.string().min(3)).min(1).max(12), useAi: z.boolean().default(false) });
  const body = schema.parse(req.body);
  const store = getStore();
  const aiConfig = body.useAi ? getAiConfig(req.user!, "websiteParse") : null;
  const parsed = await Promise.all(body.urls.map((url, index) => parseWebsiteOpportunity(url, index, req.user!, aiConfig)));
  for (const item of parsed) {
    const existing = store.websiteOpportunities.find((row) => row.ownerId === req.user!.id && row.website === item.website);
    if (existing) Object.assign(existing, item, { id: existing.id, status: existing.status, customerId: existing.customerId, dealId: existing.dealId });
    else store.websiteOpportunities.unshift(item);
  }
  await store.persist();
  res.json({ opportunities: parsed });
}));

app.post("/api/tools/website-scrape/sync-opportunities", requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    opportunities: z.array(z.object({
      id: z.string().optional(),
      company: z.string().min(1),
      business: z.string().default("待维护"),
      country: z.string().default("未知"),
      website: z.string().min(3),
      contact: z.string().default("待维护"),
      contactInfo: z.string().default(""),
      description: z.string().default("")
    })).min(1)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const created: Array<{ customer: Customer; deal: Deal; opportunity: WebsiteOpportunity }> = [];
  for (const source of body.opportunities) {
    const contact = source.contact || source.contactInfo || "待维护";
    let customer = store.customers.find((item) => canSeeOwner(req.user!, item.ownerId, item.teamId) && item.company.toLowerCase() === source.company.toLowerCase());
    if (!customer) {
      customer = {
        id: `c_web_${Date.now()}_${created.length}`,
        company: source.company,
        country: source.country || "未知",
        contact,
        ownerId: req.user!.id,
        teamId: req.user!.teamId,
        stage: "询盘",
        amount: 0,
        health: 68,
        nextReminder: "官网商机待核实",
        wecomBound: false,
        billingName: source.company,
        billingAddress: source.country || "",
        documentContact: contact,
        defaultPortDischarge: "",
        defaultIncoterm: "FOB Tianjin",
        defaultPaymentTerm: "30% T/T deposit, 70% before shipment"
      };
      store.customers.unshift(customer);
    }
    const deal: Deal = {
      id: `d_web_${Date.now()}_${created.length}`,
    customerId: customer.id,
    title: `${source.company} 官网产品机会`,
    stage: "询盘",
    product: source.business || "待维护",
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    ownerId: customer.ownerId,
      teamId: customer.teamId,
      nextAction: source.description || `核实官网产品：${source.business || "待维护"}，补充联系人并发起首次触达`
    };
    store.deals.unshift(deal);
    const opportunity: WebsiteOpportunity = {
      id: source.id || `web_${Date.now()}_${created.length}`,
      company: source.company,
      business: source.business || "待维护",
      country: source.country || "未知",
      website: normalizeWebsite(source.website),
      contact,
      contactInfo: source.contactInfo || "",
      description: source.description || "已同步为客户与商机，下一步核实采购负责人和产品需求。",
      ownerId: req.user!.id,
      teamId: req.user!.teamId,
      status: "synced",
      createdAt: new Date().toISOString(),
      customerId: customer.id,
      dealId: deal.id,
      parseMode: "rule"
    };
    const existing = store.websiteOpportunities.find((item) => item.id === opportunity.id || (item.ownerId === req.user!.id && item.website === opportunity.website));
    if (existing) Object.assign(existing, opportunity, { id: existing.id });
    else store.websiteOpportunities.unshift(opportunity);
    created.push({ customer, deal, opportunity: existing || opportunity });
  }
  await store.persist();
  res.json({ created });
}));

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeStringArray(item)).filter(Boolean).slice(0, 24);
  if (typeof value === "string") return value.split(/[\n,;，；、|]+/u).map((item) => item.trim()).filter(Boolean).slice(0, 24);
  return [];
}

function normalizeAiSiteSchemaData(value: unknown) {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, Record<string, unknown>>;
  const company = source.company_profile || {};
  const contact = source.contact_info || {};
  const taxonomy = source.business_taxonomy || {};
  const social = source.social_links || {};
  const style = source.style_requirements || {};
  return {
    company_profile: {
      legal_name: normalizeString(company.legal_name),
      wordmark: normalizeString(company.wordmark),
      tagline: normalizeString(company.tagline),
      description: normalizeString(company.description),
      logo_url: normalizeString(company.logo_url)
    },
    contact_info: {
      phone: normalizeString(contact.phone),
      email: normalizeString(contact.email),
      address: normalizeString(contact.address)
    },
    business_taxonomy: {
      product_categories: normalizeStringArray(taxonomy.product_categories).slice(0, 10),
      solutions: []
    },
    social_links: {
      linkedin: normalizeString(social.linkedin),
      youtube: normalizeString(social.youtube),
      facebook: normalizeString(social.facebook)
    },
    style_requirements: {
      preset: normalizeString(style.preset) || "industrial-professional",
      colors: normalizeStringArray(style.colors),
      keywords: normalizeStringArray(style.keywords),
      reference_sites: normalizeStringArray(style.reference_sites),
      custom_notes: normalizeString(style.custom_notes)
    }
  };
}

function normalizeAgentPayload(value: unknown, schemaData: ReturnType<typeof normalizeAiSiteSchemaData>, pages: string[]) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {
    task_type: "ai_website_build",
    schema_version: "data-schema.v1",
    locale: "zh-CN",
    source: "goodjob_ai_site_builder",
    website_data: {
      company_profile: schemaData.company_profile,
      contact_info: schemaData.contact_info,
      business_taxonomy: schemaData.business_taxonomy,
      social_links: schemaData.social_links
    },
    style_requirements: schemaData.style_requirements,
    generation_requirements: {
      target_pages: pages,
      output_mode: "project_task_draft",
      handoff_target: "agent"
    }
  };
}

const aiSiteSectionKeys = ["header", "hero", "products", "applications", "about_us", "blog", "contact_us", "footer"] as const;
type AiSiteKnownSectionKey = typeof aiSiteSectionKeys[number];
type AiSiteSectionKey = string;

const aiSiteLockedSections = new Set<AiSiteSectionKey>(["header", "footer"]);
const aiSiteCustomSectionKeyPattern = /^custom_[a-z0-9_]{6,48}$/i;

const aiSiteSectionLabels: Record<AiSiteKnownSectionKey, string> & Record<string, string> = {
  header: "Header",
  hero: "Hero",
  products: "Products",
  applications: "Applications",
  about_us: "About Us",
  blog: "Blog",
  contact_us: "Contact Us",
  footer: "Footer"
};

function isAiSiteSectionKey(value: string): value is AiSiteSectionKey {
  return (aiSiteSectionKeys as readonly string[]).includes(value) || aiSiteCustomSectionKeyPattern.test(value);
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function aiBuildRoot() {
  const configured = process.env.AI_SITE_BUILD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(goodJobProjectRoot, configured);
  }
  return path.join(goodJobProjectRoot, "projects", "ai_build");
}

function aiProjectDir(projectId: string) {
  return path.join(aiBuildRoot(), projectId);
}

function aiSiteSettingsFile() {
  return path.join(aiBuildRoot(), "_settings.json");
}

function aiSiteDesignSystemFile(projectId: string) {
  return path.join(aiProjectDir(projectId), "design-system.json");
}

function aiSiteVariantRegistryFile(projectId: string) {
  return path.join(aiProjectDir(projectId), "variant-registry.json");
}

function aiProjectMetaFile(projectId: string) {
  return path.join(aiProjectDir(projectId), "project.json");
}

function aiSiteCustomPagesFile(projectId: string) {
  return path.join(aiProjectDir(projectId), "custom-pages.json");
}

function aiSiteWpMetadataFile(projectId: string) {
  return path.join(aiProjectDir(projectId), "wp-metadata.json");
}

function aiSiteWpRebuildDir(projectId: string) {
  return path.join(aiProjectDir(projectId), "wp-rebuild");
}

function aiSiteWpRebuildExportDir(projectId: string) {
  return path.join(aiSiteWpRebuildDir(projectId), "export");
}

function aiExportDir(projectId: string) {
  return path.join(aiProjectDir(projectId), "dist");
}

function aiSectionFile(projectId: string, sectionKey: AiSiteSectionKey) {
  if (!isAiSiteSectionKey(sectionKey)) throw new Error("Invalid AI site section key");
  return path.join(aiProjectDir(projectId), "sections", `${sectionKey}.html`);
}

async function fileExists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function sectionArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 24) : [];
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

interface AiSiteCustomPageMeta {
  key: string;
  label: string;
  createdAt: string;
}

interface AiSiteSectionVariantSpec {
  id: string;
  title: string;
  purpose: string;
  wpTarget: string;
  structure: string[];
  interactions: string[];
  editableData: string[];
  visualTokens: string[];
  animation: string;
  responsive: string;
  avoid: string[];
}

interface AiSiteSectionVariantMeta {
  id: string;
  title: string;
  purpose: string;
  wp_target: string;
  structure: string[];
  interactions: string[];
  editable_data: string[];
  visual_tokens: string[];
  animation: string;
  responsive: string;
  avoid: string[];
}

interface AiSiteWpSectionMeta {
  section_key: string;
  label: string;
  section_type: string;
  layout_variant: string;
  variant_title?: string;
  variant?: AiSiteSectionVariantMeta;
  source_file: string;
  wp_role: "template-part" | "block" | "pattern" | "custom-page-section";
  wp_target: string;
  status: "locked" | "blueprint" | "html_ready";
  locked: boolean;
  order_index: number;
  updated_at: string;
}

interface AiSiteWpMetadata {
  version: string;
  project_id: string;
  site_name: string;
  site_template: string;
  wp_mode: "block-theme";
  updated_at: string;
  design_system?: {
    version: string;
    preset: string;
    palette: Record<string, string>;
    style_profile: string;
    registry_version: string;
  };
  variant_registry?: Record<string, AiSiteSectionVariantMeta[]>;
  sections: AiSiteWpSectionMeta[];
  next_stage: {
    page: string;
    purpose: string;
    status: "metadata_ready";
  };
}

interface AiSiteWpRebuildCheck {
  key: string;
  label: string;
  status: "pass" | "warning" | "error";
  message: string;
  target?: string;
}

function cleanAiSiteCustomPageLabel(value: unknown, fallback = "New Page") {
  const label = String(value ?? "").replace(/\s+/g, " ").trim();
  return (label || fallback).slice(0, 80);
}

async function readAiSiteCustomPages(project: AiSiteBuilderProject) {
  const pages = await readJsonFile<AiSiteCustomPageMeta[]>(aiSiteCustomPagesFile(project.id), []);
  return pages
    .filter((item) => item && isAiSiteSectionKey(item.key) && !(aiSiteSectionKeys as readonly string[]).includes(item.key))
    .map((item) => ({ key: item.key, label: cleanAiSiteCustomPageLabel(item.label, "Custom Page"), createdAt: item.createdAt || new Date().toISOString() }));
}

async function writeAiSiteCustomPages(project: AiSiteBuilderProject, pages: AiSiteCustomPageMeta[]) {
  await mkdir(aiProjectDir(project.id), { recursive: true });
  await writeFile(aiSiteCustomPagesFile(project.id), JSON.stringify(pages, null, 2), "utf8");
}

function aiSiteSectionLabel(sectionKey: AiSiteSectionKey, customPages: AiSiteCustomPageMeta[] = []): string {
  return aiSiteSectionLabels[sectionKey] || customPages.find((item) => item.key === sectionKey)?.label || "Custom Page";
}

function aiSiteSectionBlueprint(sectionKey: AiSiteSectionKey, blueprint: Record<string, string>, customPages: AiSiteCustomPageMeta[] = []) {
  if (blueprint[sectionKey]) return blueprint[sectionKey];
  const label = aiSiteSectionLabel(sectionKey, customPages);
  if (!(aiSiteSectionKeys as readonly string[]).includes(sectionKey)) {
    return `Custom page: ${label}. Use this page as a simple editable section that can later be generated or rewritten by the agent.`;
  }
  return sectionKey === "header" || sectionKey === "footer" ? "Fixed global component, generated automatically and locked." : "";
}

function aiSiteBlueprint(project: AiSiteBuilderProject): Record<string, string> {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const company = schema.company_profile;
  const taxonomy = schema.business_taxonomy;
  const style = schema.style_requirements;
  const siteName = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
  const categories = sectionArray(taxonomy.product_categories);
  const styleWords = sectionArray(style.keywords).join("、") || style.preset;
  return {
    hero: `首屏突出 ${siteName} 的跨境工业品牌可信度，展示核心产品、交付能力和询盘入口，视觉风格：${styleWords}。`,
    products: `产品区块聚焦 ${categories.join("、") || "核心工业产品"}，用卡片展示类别、典型参数和快速询盘入口。`,
    applications: `应用区块围绕 ${categories.join("、") || "典型工业应用场景"} 展开，说明客户痛点、应用场景和适配产品。`,
    about_us: `关于我们区块介绍 ${company.legal_name || siteName} 的成立背景、制造能力、质量体系和外贸服务能力。`,
    blog: "博客区块用于承接产品知识、选型指南、行业洞察和SEO长尾流量。",
    contact_us: "联系区块提供电话、邮箱、地址、社媒矩阵和询盘表单 CTA，降低询盘阻力。"
  };
}

function cleanAiSiteBlueprint(project: AiSiteBuilderProject): Record<string, string> {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const company = schema.company_profile;
  const taxonomy = schema.business_taxonomy;
  const style = schema.style_requirements;
  const siteName = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
  const categories = sectionArray(taxonomy.product_categories);
  const styleWords = sectionArray(style.keywords).join(", ") || style.preset || "professional";
  return {
    header: "Render the fixed B2B topbar, navigation, product dropdown, and inquiry CTA using the company brand and product categories.",
    hero: `Open with a credible industrial B2B value proposition for ${siteName}. Show product strength, export readiness, delivery capability, and a clear inquiry CTA. Visual style: ${styleWords}.`,
    products: `Present ${categories.join(", ") || "core industrial product categories"} with category cards, practical specifications, buyer benefits, and inquiry entry points.`,
    applications: `Explain application scenarios for ${categories.join(", ") || "the core product categories"} by pairing buyer pain points, operating environments, and suitable products.`,
    about_us: `Introduce ${company.legal_name || siteName} with manufacturing capability, quality control, export service process, and long-term reliability.`,
    blog: "Provide SEO-ready article cards for product knowledge, selection guides, maintenance tips, and industrial market insights.",
    contact_us: "Provide phone, email, location, social links, and an inquiry CTA that makes it easy for international buyers to contact the supplier.",
    footer: "Render the fixed B2B footer with brand summary, product categories, contact information, copyright, and a back-to-top link."
  };
}

function cleanHexColor(value: string, fallback: string) {
  const color = value.trim();
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return fallback;
  if (color.length === 4) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toUpperCase();
  return color.toUpperCase();
}

function isHexColorString(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function splitAiSiteNaturalList(values: unknown[]) {
  return values
    .flatMap((value) => (typeof value === "string" ? value.split(/[\n,，;；、]+/u) : []))
    .map((value) => value.trim())
    .filter(Boolean);
}

function aiSiteTextIncludesAny(text: string, terms: string[]) {
  const source = text.toLowerCase();
  return terms.some((term) => source.includes(term.toLowerCase()));
}

function aiSiteStyleIntentFlags(text: string) {
  return {
    minimal: aiSiteTextIncludesAny(text, ["minimal", "clean", "simple", "white", "light", "\u6781\u7b80", "\u7b80\u6d01", "\u7559\u767d", "\u5e72\u51c0", "\u6e05\u723d"]),
    tech: aiSiteTextIncludesAny(text, ["tech", "future", "cyber", "digital", "ai", "automation", "\u79d1\u6280", "\u672a\u6765", "\u667a\u80fd", "\u6570\u5b57", "\u8d5b\u535a", "\u81ea\u52a8\u5316"]),
    premium: aiSiteTextIncludesAny(text, ["premium", "luxury", "high-end", "editorial", "\u9ad8\u7aef", "\u5962\u534e", "\u8d28\u611f", "\u54c1\u724c", "\u9ad8\u7ea7", "\u7f16\u8f91\u611f"]),
    eco: aiSiteTextIncludesAny(text, ["eco", "green", "sustain", "environment", "\u73af\u4fdd", "\u7eff\u8272", "\u53ef\u6301\u7eed", "\u81ea\u7136"]),
    bold: aiSiteTextIncludesAny(text, ["bold", "strong", "aggressive", "impact", "\u6fc0\u8fdb", "\u5f3a\u70c8", "\u51b2\u51fb", "\u91cd\u5de5", "\u786c\u6717", "\u5927\u80c6"]),
    classic: aiSiteTextIncludesAny(text, ["classic", "traditional", "factory", "industrial-professional", "\u4f20\u7edf", "\u5de5\u5382", "\u7a33\u91cd"]),
    retro: aiSiteTextIncludesAny(text, ["retro", "vintage", "y2k", "millennium", "old web", "web 1.0", "classic web", "\u590d\u53e4", "\u5343\u79a7", "\u5343\u79a7\u5e74", "\u5e74\u4ee3\u611f", "\u8001\u7f51\u9875", "\u53e4\u65e9", "\u6000\u65e7"])
  };
}

function aiSiteNamedColorPalette(values: string[]) {
  const text = values.join(" ").toLowerCase();
  const definitions = [
    { pattern: /green|emerald|teal|\u7eff|\u7eff\u8272|\u9752\u7eff|\u58a8\u7eff|\u7fe1\u7fe0/i, color: "#0F766E" },
    { pattern: /blue|cyan|azure|\u84dd|\u84dd\u8272|\u5929\u84dd|\u6e56\u84dd|\u975b\u84dd/i, color: "#2563EB" },
    { pattern: /white|ivory|cream|\u767d|\u767d\u8272|\u7c73\u767d|\u8c61\u7259/i, color: "#F8FAFC" },
    { pattern: /black|charcoal|\u9ed1|\u9ed1\u8272|\u70ad\u9ed1/i, color: "#111827" },
    { pattern: /red|crimson|\u7ea2|\u7ea2\u8272|\u8d64/i, color: "#DC2626" },
    { pattern: /orange|\u6a59|\u6a59\u8272/i, color: "#F97316" },
    { pattern: /yellow|gold|\u9ec4|\u9ec4\u8272|\u91d1|\u91d1\u8272/i, color: "#D97706" },
    { pattern: /purple|violet|\u7d2b|\u7d2b\u8272/i, color: "#7C3AED" },
    { pattern: /gray|grey|silver|\u7070|\u7070\u8272|\u94f6/i, color: "#64748B" },
    { pattern: /绿|绿色|青绿|墨绿|翡翠|green|emerald|teal/u, color: "#0F766E" },
    { pattern: /蓝|蓝色|天蓝|湖蓝|靛蓝|blue|cyan|azure/u, color: "#2563EB" },
    { pattern: /白|白色|米白|象牙|white|ivory|cream/u, color: "#F8FAFC" },
    { pattern: /黑|黑色|black|charcoal/u, color: "#111827" },
    { pattern: /红|红色|red|crimson/u, color: "#DC2626" },
    { pattern: /橙|橘|橙色|orange/u, color: "#F97316" },
    { pattern: /黄|金|黄色|金色|yellow|gold/u, color: "#D97706" },
    { pattern: /紫|紫色|purple|violet/u, color: "#7C3AED" },
    { pattern: /灰|灰色|银|gray|grey|silver/u, color: "#64748B" }
  ];
  const colors: string[] = [];
  for (const definition of definitions) {
    if (definition.pattern.test(text) && !colors.includes(definition.color)) colors.push(definition.color);
  }
  return colors;
}

function resolveAiSitePaletteColors(colors: string[]) {
  const naturalColors = splitAiSiteNaturalList(colors);
  const explicitHex = naturalColors.filter(isHexColorString).map((color) => cleanHexColor(color, "#000000"));
  return explicitHex.length ? explicitHex : aiSiteNamedColorPalette(naturalColors.length ? naturalColors : colors);
}

function hexToRgb(color: string) {
  const clean = cleanHexColor(color, "#000000").slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mixHexColor(color: string, target: string, amount: number) {
  const from = hexToRgb(color);
  const to = hexToRgb(target);
  return rgbToHex(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount
  );
}

function readableTextOn(color: string) {
  const { r, g, b } = hexToRgb(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#16202E" : "#FFFFFF";
}

function aiSiteStyleProfile(project: AiSiteBuilderProject, palette: { brand: string; accent: string; surface: string; brandDeep: string; brandWide: string; dark: string }) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const style = schema.style_requirements;
  const keywords = sectionArray(style.keywords);
  const referenceSites = sectionArray(style.reference_sites);
  const text = `${style.preset || project.tone || ""} ${keywords.join(" ")} ${style.custom_notes || ""}`.toLowerCase();
  const intent = aiSiteStyleIntentFlags(text);
  const isMinimal = /minimal|clean|simple|white|light|极简|简洁|留白/.test(text);
  const isTech = /tech|future|cyber|digital|ai|automation|科技|未来|智能|数字/.test(text);
  const isPremium = /premium|luxury|high-end|editorial|高端|奢华|质感|品牌/.test(text);
  const isEco = /eco|green|sustain|environment|环保|绿色|可持续/.test(text);
  const isBold = /bold|strong|aggressive|impact|激进|强烈|冲击|重工业/.test(text);
  const isClassic = /classic|traditional|factory|industrial-professional|传统|工厂|稳重/.test(text);
  const cnMinimal = /极简|简洁|留白|干净|清爽/.test(text);
  const cnTech = /科技|未来|智能|数字|赛博|自动化/.test(text);
  const cnPremium = /高端|奢华|质感|品牌|高级|编辑感/.test(text);
  const cnEco = /环保|绿色|可持续|自然/.test(text);
  const cnBold = /激进|强烈|冲击|重工|硬朗|大胆/.test(text);
  const wantsMinimal = isMinimal || cnMinimal || intent.minimal;
  const wantsTech = isTech || cnTech || intent.tech;
  const wantsPremium = isPremium || cnPremium || intent.premium;
  const wantsEco = isEco || cnEco || intent.eco;
  const wantsBold = isBold || cnBold || intent.bold;
  const wantsRetro = /retro|vintage|y2k|millennium|old\s*web|web\s*1\.0|classic\s*web|复古|千禧|千禧年|年代感|老网页|古早|怀旧|可靠/u.test(text);
  const wantsRetroProfile = wantsRetro || intent.retro;
  const mood = wantsRetroProfile ? "retro Y2K reliable web" : wantsTech ? "technical futuristic" : wantsEco ? "clean sustainable" : wantsPremium ? "premium editorial" : wantsMinimal ? "minimal precision" : wantsBold ? "bold industrial" : "professional industrial";
  const density = wantsRetroProfile ? "compact-layered" : wantsMinimal || wantsPremium ? "spacious" : wantsTech || wantsBold ? "dense-but-layered" : "balanced";
  const shape = wantsRetroProfile ? "boxed" : wantsTech || wantsBold ? "sharp" : wantsMinimal || wantsEco ? "soft" : "industrial";
  const background = wantsTech
    ? "dark-to-light technical gradients, subtle grid lines, data-like accents"
    : wantsRetroProfile
      ? "green-blue-white old-web surfaces, visible borders, boxed panels, modest shadows, nostalgic but readable contrast"
      : wantsEco
        ? "light surfaces, green-tinted bands, natural whitespace, soft dividers"
        : wantsPremium
          ? "deep editorial contrast, large quiet whitespace, refined accent lines"
          : wantsMinimal
            ? "white and near-white bands, thin rules, sparse cards"
            : wantsBold
              ? "high-contrast dark bands, strong diagonal or stepped panels"
              : "industrial navy/steel bands with controlled accent details";
  const composition = wantsTech
    ? "layered dashboards, timeline rails, spec chips, glow-free technical surfaces"
    : wantsRetroProfile
      ? "old-web inspired vertical rhythm with framed headers, bordered category groups, compact badges, and table-like proof modules"
      : wantsEco
        ? "breathing vertical sections, soft proof bands, rounded product/category panels"
        : wantsPremium
          ? "editorial asymmetry, oversized type, restrained cards, magazine-like feature blocks"
          : wantsMinimal
            ? "single-column clarity, whitespace-first layouts, thin dividers, compact proof rows"
            : wantsBold
              ? "large blocks, strong hierarchy, stepped grids, dark proof strips"
              : "B2B industrial rhythm with varied vertical sections and practical proof modules";
  const ctaStyle = wantsRetroProfile ? "boxed retro" : wantsMinimal || wantsEco ? "clean rounded" : wantsTech || wantsBold ? "sharp high-contrast" : wantsPremium ? "refined editorial" : "industrial rectangular";
  const avoid = [
    "do not force the old navy/red palette if form colors or style words point elsewhere",
    "do not repeat the same heading plus 3-card grid in every section",
    wantsMinimal ? "avoid heavy dark blocks and noisy technical decoration" : "",
    wantsTech ? "avoid beige, soft corporate SaaS cards, and generic factory brochure layout" : "",
    wantsPremium ? "avoid crowded grids and cheap badge-heavy styling" : "",
    wantsEco ? "avoid harsh black/red aggression unless supplied by user colors" : "",
    wantsBold ? "avoid pale low-contrast minimal pages" : "",
    wantsRetroProfile ? "avoid sleek modern SaaS cards, glassmorphism, and the default blue industrial template" : ""
  ].filter(Boolean);
  return {
    mood,
    density,
    shape,
    background,
    composition,
    ctaStyle,
    keywords,
    customNotes: style.custom_notes || "",
    referenceSites,
    avoid,
    palette,
    summary: `${mood}; ${density}; ${shape} geometry; ${background}; ${composition}`
  };
}

function aiSiteDesignSystem(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const style = schema.style_requirements;
  const rawColors = sectionArray(style.colors);
  let colors = resolveAiSitePaletteColors(rawColors);
  const preset = (style.preset || project.tone || "industrial-professional").toLowerCase();
  const naturalKeywords = splitAiSiteNaturalList(sectionArray(style.keywords));
  const styleText = `${preset} ${naturalKeywords.join(" ")} ${style.custom_notes || ""} ${rawColors.join(" ")}`.toLowerCase();
  const intent = aiSiteStyleIntentFlags(styleText);
  if (!colors.length && intent.retro) {
    colors = ["#0F766E", "#2563EB", "#F8FAFC"];
  }
  if (!colors.length && /retro|vintage|y2k|millennium|old\s*web|web\s*1\.0|复古|千禧|千禧年|年代感|老网页|古早|怀旧/u.test(styleText)) {
    colors = ["#0F766E", "#2563EB", "#F8FAFC"];
  }
  const fallbackPalette = /minimal|clean|极简|简洁|留白|干净|清爽/.test(styleText)
    ? ["#2563EB", "#0EA5E9", "#F8FAFC"]
    : /tech|future|cyber|科技|未来|智能|数字|赛博|自动化/.test(styleText)
      ? ["#4F46E5", "#06B6D4", "#F5F3FF"]
      : /eco|green|sustainable|环保|绿色|可持续|自然/.test(styleText)
        ? ["#0F766E", "#F97316", "#F0FDFA"]
        : /luxury|premium|high-end|editorial|高端|奢华|质感|品牌|高级|编辑感/.test(styleText)
          ? ["#111827", "#D97706", "#F8FAFC"]
          : ["#143A7B", "#C8161C", "#F4F6FA"];
  const intentFallbackPalette = intent.minimal
    ? ["#2563EB", "#0EA5E9", "#F8FAFC"]
    : intent.tech
      ? ["#4F46E5", "#06B6D4", "#F5F3FF"]
      : intent.eco
        ? ["#0F766E", "#F97316", "#F0FDFA"]
        : intent.premium
          ? ["#111827", "#D97706", "#F8FAFC"]
          : intent.retro
            ? ["#0F766E", "#2563EB", "#F8FAFC"]
            : fallbackPalette;
  const brand = cleanHexColor(colors[0] || "", intentFallbackPalette[0]);
  const accent = cleanHexColor(colors[1] || "", intentFallbackPalette[1]);
  const surface = cleanHexColor(colors[2] || "", intentFallbackPalette[2]);
  const brandDeep = cleanHexColor(colors[3] || "", mixHexColor(brand, "#000000", 0.54));
  const brandWide = mixHexColor(brand, "#FFFFFF", 0.14);
  const dark = cleanHexColor(colors[4] || "", mixHexColor(brandDeep, "#000000", 0.28));
  const styleProfile = aiSiteStyleProfile(project, { brand, accent, surface, brandDeep, brandWide, dark });
  return {
    version: "ai-site-design-system.v2-xinhai-industrial",
    preset: style.preset || project.tone || "industrial-professional",
    styleProfile,
    palette: {
      brand,
      accent,
      brandDeep,
      brandWide,
      ink: "#16202E",
      body: "#3C4858",
      muted: "#6B7686",
      line: "#E2E7EE",
      surface,
      steel: "#EAEEF4",
      dark,
      light: "#ffffff"
    },
    typography: {
      family: "Barlow, Inter, Arial, sans-serif",
      displayFamily: "Barlow Semi Condensed, Barlow, Arial, sans-serif",
      h1: "clamp(40px,5.4vw,72px)",
      h2: "clamp(30px,3.6vw,46px)",
      body: "clamp(16px,1.2vw,17px)",
      lineHeight: "1.72"
    },
    layout: {
      wrapper: "width:min(1280px,calc(100vw - clamp(32px,6vw,120px)));margin:auto",
      sectionPadding: "96px 0 desktop, 64px 0 mobile",
      gap: "clamp(18px,3vw,32px)",
      grid: "repeat(auto-fit,minmax(min(280px,100%),1fr))",
      mobileBreakpoint: "760px",
      tabletBreakpoint: "1080px",
      wideBreakpoint: "1200px",
      fixedModules: ["topbar", "sticky-header", "hero-slider-look", "hero-stats-strip", "section-head", "card-grid", "cta-band", "footer"]
    },
    components: {
      cardRadius: styleProfile.shape === "soft" ? "12px" : styleProfile.shape === "sharp" ? "2px" : "6px",
      cardBorder: "1px solid #E2E7EE",
      shadow: "0 24px 60px rgba(16,32,60,.16)",
      buttonRadius: styleProfile.shape === "soft" ? "999px" : styleProfile.shape === "sharp" ? "2px" : "6px",
      primaryButton: `${styleProfile.ctaStyle} CTA with arrow icon`,
      secondaryButton: "transparent or white outlined rectangular CTA"
    },
    icons: {
      sprite: "inline SVG symbols injected by framework",
      allowedIds: ["icon-location", "icon-phone", "icon-mail", "icon-linkedin", "icon-youtube", "icon-facebook", "icon-arrow-right", "icon-cube", "icon-globe", "icon-expertise", "icon-building", "icon-check", "icon-send"]
    },
    rules: [
      "Use the same palette and spacing tokens in every section, but vary section composition according to the style profile.",
      `Style profile: ${styleProfile.summary}`,
      "Every generated business section must include one scoped style tag as its first child.",
      "Selectors must be prefixed with the current section id.",
      "Use semantic section/article/list markup that can become a WordPress block.",
      "Use <svg><use href=\"#icon-name\"></use></svg> for framework icons instead of inventing new icon paths.",
      "Avoid unscoped .container, .grid, .card, body, html, :root, header, footer selectors."
    ]
  };
}

function aiSiteSectionVariantRegistry(): Record<AiSiteKnownSectionKey, AiSiteSectionVariantSpec[]> {
  return {
    header: [{
      id: "locked_fixed_header",
      title: "Locked B2B Header",
      purpose: "Global topbar, navigation, product dropdown, and inquiry CTA shared by every route.",
      wpTarget: "template-parts/header.html",
      structure: ["topbar contact/social strip", "brand wordmark", "fixed navigation", "Products dropdown from product_categories", "mobile menu button", "inquiry CTA"],
      interactions: ["mobile menu toggle", "product dropdown hover/focus", "WP route links generated by route map"],
      editableData: ["brand", "contact_info", "social_links", "product_categories", "nav labels"],
      visualTokens: ["brand", "accent", "brandDeep", "line", "light"],
      animation: "subtle dropdown and mobile menu only",
      responsive: "desktop horizontal nav; mobile collapses into menu while labels never wrap",
      avoid: ["CRM links", "logout/login controls", "hard-coded local domain", "duplicated page anchors in WP export"]
    }],
    hero: [{
      id: "darkened_photo_hero_slider",
      title: "Darkened Photo Hero Slider",
      purpose: "High-impact first viewport with brand-specific headline, three background images, clear CTA pair, and later image-upload hooks.",
      wpTarget: "blocks/hero-photo-slider",
      structure: ["72vh photo stage", "dark overlay", "eyebrow", "two-line H1", "subtitle", "Request a Proposal CTA", "Learn More CTA", "bottom-right slider controls"],
      interactions: ["CSS radio fallback", "6-second auto switch enhanced by theme JS", "future hero background upload slots"],
      editableData: ["headline", "subtitle", "eyebrow", "button labels", "background images"],
      visualTokens: ["brandDeep overlay", "accent CTA", "white text", "imageTreatment: full-bleed darkened"],
      animation: "background cross-fade and subtle CTA hover",
      responsive: "fixed 72vh stage; H1 max two visual lines; controls stay bottom-right on desktop and compact on mobile",
      avoid: ["extra metrics", "cards", "side panels", "product grids", "generic Industrial... headline"]
    }, {
      id: "technical_banner_focus",
      title: "Technical Banner Focus",
      purpose: "A calmer hero variant for precision or minimal styles with lighter overlay and tighter proof chips.",
      wpTarget: "blocks/hero-technical-banner",
      structure: ["banner image", "headline", "subtitle", "two CTAs", "small proof chips"],
      interactions: ["button hover", "optional static background upload slot"],
      editableData: ["headline", "subtitle", "proof chips", "background image"],
      visualTokens: ["surface", "brand", "accent", "thin rules"],
      animation: "light reveal only",
      responsive: "reflows into single-column banner on mobile",
      avoid: ["dark heavy treatment when style asks for minimal precision", "busy metrics strip"]
    }],
    products: [{
      id: "product_category_tabs_catalog_slider",
      title: "Category Tabs Catalog Slider",
      purpose: "Product-category-first browsing with card previews that later map cleanly to product CPT archive/query data.",
      wpTarget: "blocks/products-category-catalog",
      structure: ["Product Category heading", "intro copy", "category buttons", "active-category product cards", "left/right browsing arrows"],
      interactions: ["data-product-category button switching", "radio fallback pages", "card inquiry links to contact"],
      editableData: ["product_categories", "product CPT items", "product images", "category descriptions"],
      visualTokens: ["surface cards", "brand active tab", "accent arrows", "product image ratio"],
      animation: "tab switch and card hover lift",
      responsive: "4-card desktop stage; 2-column tablet; 1-column mobile with arrows hidden",
      avoid: ["plain 3-card grid", "spec matrix only", "hard-split backgrounds", "inert category spans", "href=#"]
    }, {
      id: "category_sidebar_grid",
      title: "Sidebar Category Grid",
      purpose: "Archive-like product browsing with category rail and dense product grid for larger catalogs.",
      wpTarget: "blocks/products-sidebar-grid",
      structure: ["left category rail", "right product grid", "featured category intro", "RFQ CTA"],
      interactions: ["category filter buttons", "product card links", "sticky category rail on desktop"],
      editableData: ["product_categories", "product CPT items", "featured category"],
      visualTokens: ["brand sidebar", "light card grid", "accent hover"],
      animation: "card hover and category active state",
      responsive: "category rail becomes horizontal scroll on mobile",
      avoid: ["small unreadable product cards", "one product per row on desktop"]
    }],
    applications: [{
      id: "applications_horizontal_card_preview",
      title: "Horizontal Scenario Cards",
      purpose: "Scenario-driven application preview that separates buyer context from product catalog browsing.",
      wpTarget: "blocks/applications-scenario-map",
      structure: ["title block", "horizontal scenario card row", "pain point", "suitable product chip", "outcome", "CTA"],
      interactions: ["horizontal scroll/snap", "CTA links to contact/products", "card hover focus"],
      editableData: ["application scenarios", "pain points", "product/category mapping", "outcomes"],
      visualTokens: ["continuous background", "card surface", "contrast-safe text", "brand chips"],
      animation: "horizontal preview scroll and hover border accent",
      responsive: "desktop horizontal preview; mobile single-column or horizontal snap with readable cards",
      avoid: ["hard-split color blocks", "gray text on dark blue", "same product-card layout", "decorative layers over links"]
    }, {
      id: "industry_matrix",
      title: "Industry Matrix",
      purpose: "A structured matrix for industries, environments, recommended products, and RFQ notes.",
      wpTarget: "blocks/applications-industry-matrix",
      structure: ["industry tabs", "environment rows", "recommended products", "RFQ notes"],
      interactions: ["tab buttons", "row hover", "contact CTA"],
      editableData: ["industries", "environments", "product mapping"],
      visualTokens: ["table-like lines", "brand tab", "light rows"],
      animation: "tab reveal only",
      responsive: "matrix becomes stacked cards on mobile",
      avoid: ["wide table overflow", "dense unreadable cells"]
    }],
    about_us: [{
      id: "capability_stack_and_quality_process",
      title: "Capability Stack + Quality Process",
      purpose: "Institutional proof section showing capability, documentation, reliability, and process without becoming another product grid.",
      wpTarget: "blocks/about-capability-stack",
      structure: ["title block", "capability stack", "documentation/proof card", "reliability note", "quality/export process belt"],
      interactions: ["CTA to contact", "process item hover"],
      editableData: ["company profile", "capability items", "proof points", "process steps"],
      visualTokens: ["continuous background", "dark panel", "white card", "explicit text contrast"],
      animation: "calm reveal and process hover",
      responsive: "desktop asymmetric panels; mobile stacked panels with consistent spacing",
      avoid: ["hard-split backgrounds", "low-contrast dark text on blue", "founder-story-only cards", "oversized decorative badges"]
    }, {
      id: "timeline_factory_proof",
      title: "Factory Proof Timeline",
      purpose: "Chronological proof of growth, factory capability, inspection, and export readiness.",
      wpTarget: "blocks/about-factory-timeline",
      structure: ["intro", "timeline", "proof metrics", "quality statement"],
      interactions: ["timeline hover", "contact CTA"],
      editableData: ["milestones", "metrics", "factory proof points"],
      visualTokens: ["timeline rail", "brand dots", "light cards"],
      animation: "timeline reveal",
      responsive: "timeline collapses into vertical cards",
      avoid: ["fake founder story", "unsubstantiated oversized numbers"]
    }],
    blog: [{
      id: "industrial_editorial_digest",
      title: "Industrial Editorial Digest",
      purpose: "SEO-oriented knowledge block with one featured article and compact recent posts.",
      wpTarget: "blocks/recent-blogs-split",
      structure: ["RECENT BLOGS title", "large featured post", "More Blogs action", "dated article rows"],
      interactions: ["article links", "more blogs archive link", "hover underline"],
      editableData: ["news CPT items", "dates", "categories", "excerpt", "featured image"],
      visualTokens: ["editorial whitespace", "brand headings", "date muted text", "image ratio"],
      animation: "article hover and subtle reveal",
      responsive: "desktop split editorial; mobile one-column list",
      avoid: ["same product card grid", "fake news clutter", "large equal blocks only"]
    }, {
      id: "resource_center_index",
      title: "Resource Center Index",
      purpose: "Guide-style content index grouped by selection, maintenance, troubleshooting, and export documents.",
      wpTarget: "blocks/blog-resource-index",
      structure: ["intent filter chips", "guide cards", "latest insights"],
      interactions: ["filter chips", "archive CTA"],
      editableData: ["news CPT items", "intent tags"],
      visualTokens: ["light cards", "accent chips", "thin dividers"],
      animation: "chip hover and card lift",
      responsive: "chips wrap; cards become one column",
      avoid: ["too many cards above the fold"]
    }],
    contact_us: [{
      id: "inquiry_command_center",
      title: "Fixed Inquiry Command Center",
      purpose: "Conversion-critical contact section with fixed left trust column and right visible inquiry form.",
      wpTarget: "blocks/contact-inquiry-form",
      structure: ["left trust/CTA column", "contact channels", "RFQ checklist", "right white form panel", "required fields", "SEND INQUIRY button"],
      interactions: ["form controls", "mailto/tel fallback", "submit button hover", "future CF7 replacement"],
      editableData: ["contact_info", "response promise", "form labels", "RFQ checklist"],
      visualTokens: ["dark trust surface", "white form card", "accent submit", "contrast-safe text"],
      animation: "form card reveal and button hover",
      responsive: "desktop two columns; mobile stacks trust column before form",
      avoid: ["CTA-only contact block", "map placeholder", "footer-style contact grid", "hidden form"]
    }],
    footer: [{
      id: "locked_fixed_footer",
      title: "Locked B2B Footer",
      purpose: "Global footer with brand summary, product links, contact data, social links, and copyright.",
      wpTarget: "template-parts/footer.html",
      structure: ["brand summary", "capabilities", "product categories", "contact channels", "copyright bar"],
      interactions: ["back-to-top link", "social links", "WP route links"],
      editableData: ["brand", "company description", "product_categories", "contact_info", "social_links"],
      visualTokens: ["dark footer", "accent icons", "light text"],
      animation: "none beyond hover",
      responsive: "four columns desktop; one column mobile",
      avoid: ["oversized icons", "duplicated header nav", "CRM/system links"]
    }]
  };
}

function aiSiteSectionVariantMeta(spec: AiSiteSectionVariantSpec): AiSiteSectionVariantMeta {
  return {
    id: spec.id,
    title: spec.title,
    purpose: spec.purpose,
    wp_target: spec.wpTarget,
    structure: spec.structure,
    interactions: spec.interactions,
    editable_data: spec.editableData,
    visual_tokens: spec.visualTokens,
    animation: spec.animation,
    responsive: spec.responsive,
    avoid: spec.avoid
  };
}

function aiSiteVariantRegistryMeta() {
  const registry = aiSiteSectionVariantRegistry();
  return Object.fromEntries(Object.entries(registry).map(([key, specs]) => [key, specs.map(aiSiteSectionVariantMeta)]));
}

function aiSiteDefaultVariantSpec(sectionKey: AiSiteSectionKey): AiSiteSectionVariantSpec {
  const registry = aiSiteSectionVariantRegistry();
  if ((aiSiteSectionKeys as readonly string[]).includes(sectionKey)) {
    return registry[sectionKey as AiSiteKnownSectionKey]?.[0] || registry.hero[0];
  }
  return {
    id: "custom_simple_page",
    title: "Custom Simple Page",
    purpose: "Editable custom page section that can be promoted to a WordPress pattern or block later.",
    wpTarget: "patterns/custom-simple-page",
    structure: ["custom page heading", "intro copy", "content band", "CTA row"],
    interactions: ["CTA to contact"],
    editableData: ["page title", "intro copy", "body copy", "CTA label"],
    visualTokens: ["surface", "brand", "accent", "line"],
    animation: "basic reveal only",
    responsive: "single-column mobile-safe layout",
    avoid: ["header/footer duplication", "CRM links", "full homepage shell"]
  };
}

function aiSiteSelectVariantSpec(project: AiSiteBuilderProject, sectionKey: AiSiteSectionKey): AiSiteSectionVariantSpec {
  const base = aiSiteDefaultVariantSpec(sectionKey);
  if (!(aiSiteSectionKeys as readonly string[]).includes(sectionKey)) return base;
  const registry = aiSiteSectionVariantRegistry()[sectionKey as AiSiteKnownSectionKey] || [base];
  const styleProfile = aiSiteDesignSystem(project).styleProfile;
  const text = `${styleProfile.mood} ${styleProfile.summary} ${styleProfile.customNotes} ${styleProfile.keywords.join(" ")}`.toLowerCase();
  if (sectionKey === "hero" && /minimal|precision|clean|white|light/.test(text)) return registry.find((item) => item.id === "technical_banner_focus") || base;
  if (sectionKey === "products" && /large catalog|dense|sidebar|archive|many product|many categories/.test(text)) return registry.find((item) => item.id === "category_sidebar_grid") || base;
  if (sectionKey === "applications" && /matrix|technical|spec|table/.test(text)) return registry.find((item) => item.id === "industry_matrix") || base;
  if (sectionKey === "about_us" && /timeline|history|factory proof|milestone/.test(text)) return registry.find((item) => item.id === "timeline_factory_proof") || base;
  if (sectionKey === "blog" && /resource|knowledge base|guide|index/.test(text)) return registry.find((item) => item.id === "resource_center_index") || base;
  return base;
}

const aiSiteThemePalettes = [
  ["#143A7B", "#C8161C", "#F4F6FA", "#0E2A5C", "#0C1B33"],
  ["#0F766E", "#F97316", "#F0FDFA", "#064E3B", "#062D2A"],
  ["#4F46E5", "#E11D48", "#F5F3FF", "#312E81", "#17113D"],
  ["#1D4ED8", "#D97706", "#EFF6FF", "#1E3A8A", "#111827"],
  ["#334155", "#DC2626", "#F8FAFC", "#0F172A", "#020617"]
];

function refreshAiSiteProjectThemePalette(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const current = sectionArray(schema.style_requirements.colors);
  const currentKey = current.slice(0, 5).join("|").toUpperCase();
  const currentIndex = aiSiteThemePalettes.findIndex((palette) => palette.join("|").toUpperCase() === currentKey);
  const validCustom = current
    .slice(0, 5)
    .filter((color) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))
    .map((color) => cleanHexColor(color, "#143A7B"));
  if (validCustom.length >= 2 && currentIndex < 0) {
    schema.style_requirements.colors = validCustom;
    project.schemaData = schema;
    project.tone = schema.style_requirements.preset || project.tone;
    return validCustom;
  }
  const nextPalette = aiSiteThemePalettes[currentIndex >= 0 ? (currentIndex + 1) % aiSiteThemePalettes.length : 1];
  schema.style_requirements.colors = nextPalette;
  project.schemaData = schema;
  project.tone = schema.style_requirements.preset || project.tone;
  return nextPalette;
}

function looksCorruptAiSiteText(value: string) {
  return /�|銆|鐨|鍖|浣|涓|绔|绯|logoutButton|login-screen|GoodJob CRM/i.test(value);
}

function brandWithHighlight(brand: string) {
  const clean = brand.trim() || "GoodJob";
  if (clean.length <= 3) return `<span>${htmlEscape(clean)}</span>`;
  return `${htmlEscape(clean.slice(0, -3))}<span>${htmlEscape(clean.slice(-3))}</span>`;
}

function aiSiteIconSprite() {
  return `<svg data-ai-site-sprite="xinhai-reference" xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="icon-location" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 7l10 7 10-7" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-linkedin" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" fill="currentColor"/><circle cx="4" cy="4" r="2" fill="currentColor"/></symbol><symbol id="icon-youtube" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" fill="currentColor"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor"/></symbol><symbol id="icon-facebook" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="currentColor"/></symbol><symbol id="icon-caret-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5"/></symbol><symbol id="icon-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol><symbol id="icon-arrow-left" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-arrow-next" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></symbol><symbol id="icon-cube" viewBox="0 0 24 24"><path d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 22V12M21 6.5L12 12 3 6.5" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-expertise" viewBox="0 0 24 24"><path d="M12 8V4M8 4h8M4 22V12a8 8 0 0116 0v10M4 22h16" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-building" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol><symbol id="icon-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3"/></symbol><symbol id="icon-send" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" stroke-width="2.2"/></symbol><symbol id="icon-to-top" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" fill="none" stroke="currentColor" stroke-width="2.4"/></symbol></svg>`;
}

function aiSiteFrameworkCss(project?: AiSiteBuilderProject) {
  const design = project ? aiSiteDesignSystem(project) : null;
  const palette = design?.palette;
  const brand = palette?.brand || "#143A7B";
  const accent = palette?.accent || "#C8161C";
  const brandDeep = palette?.brandDeep || mixHexColor(brand, "#000000", 0.54);
  const brandWide = palette?.brandWide || mixHexColor(brand, "#FFFFFF", 0.14);
  const footer = palette?.dark || mixHexColor(brandDeep, "#000000", 0.28);
  const surface = palette?.surface || "#F4F6FA";
  return `:root{--blue:${brand};--blue-deep:${brandDeep};--blue-700:${brandWide};--red:${accent};--red-deep:${mixHexColor(accent, "#000000", 0.18)};--ink:#16202E;--body:#3C4858;--mid:#6B7686;--line:#E2E7EE;--bg:#FFFFFF;--bg-soft:${surface};--bg-steel:#EAEEF4;--footer:${footer};--footer-2:${mixHexColor(footer, "#000000", 0.16)};--gold:#E8A12C;--max:1280px;--r:4px;--ease:cubic-bezier(.4,0,.2,1);--shadow:0 10px 30px rgba(16,32,60,.10);--shadow-lg:0 24px 60px rgba(16,32,60,.16)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Barlow,Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--body);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}svg{display:block}.container,.ai-wrap{width:min(var(--max),calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.ai-topbar{background:var(--blue-deep);color:#AFC0DD;font-size:13.5px}.ai-topbar .container{min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:18px}.ai-topbar-left,.ai-topbar-right,.ai-socials,.ai-contact-line{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.ai-topbar svg{width:14px;height:14px;color:var(--red);flex:none}.ai-socials a{width:24px;height:24px;border:1px solid rgba(255,255,255,.18);border-radius:3px;display:grid;place-items:center;color:#C7D5EC}.ai-socials a:hover{background:var(--red);border-color:var(--red);color:#fff}.ai-socials svg{width:12px;height:12px}.ai-header{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 1px 0 rgba(16,32,60,.04)}.ai-nav{min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:clamp(14px,2vw,28px)}.ai-brand{font-weight:800;color:var(--blue);font-size:clamp(24px,2vw,34px);letter-spacing:-.02em;line-height:1;white-space:nowrap;flex:none}.ai-brand small{display:block;font-size:10px;color:var(--mid);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}.ai-brand span{color:var(--red)}.ai-nav-menu{display:flex;align-items:center;gap:4px;list-style:none;margin:0;padding:0;flex-wrap:nowrap;min-width:0}.ai-nav-menu li{flex:none}.ai-nav-link{display:flex;align-items:center;gap:6px;height:84px;padding:0 clamp(9px,1vw,17px);font-weight:700;font-size:clamp(13.5px,1vw,15px);color:var(--ink);position:relative;white-space:nowrap;flex:none}.ai-nav-link svg{width:12px;height:12px;flex:none}.ai-nav-link::after{content:"";position:absolute;left:17px;right:17px;bottom:24px;height:2px;background:var(--red);transform:scaleX(0);transform-origin:left;transition:transform .28s var(--ease)}.ai-nav-link:hover::after,.ai-nav-link.is-active::after{transform:scaleX(1)}.ai-caret{width:10px;height:10px}.ai-nav-item{position:relative}.ai-dropdown{position:absolute;top:100%;left:0;min-width:280px;background:#fff;border:1px solid var(--line);border-top:3px solid var(--red);box-shadow:var(--shadow);padding:10px;opacity:0;visibility:hidden;transform:translateY(10px);transition:all .26s var(--ease);border-radius:0 0 var(--r) var(--r)}.ai-nav-item:hover .ai-dropdown{opacity:1;visibility:visible;transform:none}.ai-dropdown a{display:flex;align-items:center;gap:10px;padding:11px 14px;font-size:14.5px;font-weight:600;color:var(--body);border-radius:3px;white-space:nowrap}.ai-dropdown a::before{content:"";width:6px;height:6px;background:var(--red);border-radius:50%;flex:none}.ai-header-cta{display:flex;align-items:center;gap:12px;flex:none}.ai-cta-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#F1F5FB;color:var(--blue);flex:none}.ai-cta-icon svg{width:20px;height:20px}.ai-header-cta > span:not(.ai-cta-icon){display:block;font-size:12px;color:var(--mid)}.ai-header-cta b{display:block;color:var(--ink);font-size:16px;white-space:nowrap}.ai-menu-button{display:none;width:46px;height:46px;border:1px solid var(--line);border-radius:4px;background:#fff;place-items:center}.ai-menu-button i,.ai-menu-button i::before,.ai-menu-button i::after{display:block;width:22px;height:2px;background:var(--ink);content:""}.ai-menu-button i::before{transform:translateY(-7px)}.ai-menu-button i::after{transform:translateY(5px)}.ai-hero{position:relative;min-height:clamp(560px,82vh,760px);padding:0;overflow:hidden;background:radial-gradient(circle at 72% 32%,rgba(127,176,255,.18),transparent 28%),linear-gradient(100deg,rgba(10,22,41,.96) 0%,rgba(10,22,41,.78) 48%,rgba(10,22,41,.48) 100%),linear-gradient(135deg,#20344f 0%,#6f7f83 48%,#1d3b65 100%);color:#fff}.ai-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:72px 72px;opacity:.35}.ai-hero-inner{position:relative;z-index:2;min-height:inherit;display:flex;align-items:center}.ai-hero-card{max-width:720px}.ai-hero-tag{display:inline-flex;align-items:center;gap:10px;background:rgba(200,22,28,.16);border:1px solid rgba(200,22,28,.5);color:#FFB2B6;font-weight:800;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px;border-radius:var(--r);margin-bottom:22px}.ai-hero-tag::before{content:"";width:8px;height:8px;background:var(--red);border-radius:50%;box-shadow:0 0 0 4px rgba(200,22,28,.3)}.ai-hero h1{font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif;font-size:clamp(40px,5.4vw,72px);line-height:.98;color:#fff;letter-spacing:.01em;margin:0 0 20px}.ai-hero p{font-size:clamp(16px,1.7vw,20px);line-height:1.7;color:#C8D6EE;max-width:620px;margin:0 0 34px}.ai-actions,.btn-row{display:flex;gap:16px;flex-wrap:wrap}.ai-btn,.primary-btn,.ghost-btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 28px;border-radius:var(--r);font-weight:800;text-transform:uppercase;letter-spacing:.03em}.ai-btn svg,.primary-btn svg,.ghost-btn svg{width:18px;height:18px}.ai-btn-primary,.primary-btn{background:var(--red);color:#fff;border:1px solid var(--red)}.ai-btn-ghost,.ghost-btn{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.46)}.ai-hero-nav{position:absolute;z-index:3;left:0;right:0;bottom:38px}.ai-hero-nav .container{display:flex;justify-content:space-between;align-items:center}.ai-hero-dots{display:flex;gap:10px}.ai-dot{width:38px;height:4px;background:rgba(255,255,255,.3);border-radius:2px}.ai-dot.is-active{background:var(--red);width:54px}.ai-hero-arrows{display:flex;gap:10px}.ai-arrow{width:50px;height:50px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.05);color:#fff;border-radius:var(--r);display:grid;place-items:center}.ai-arrow svg{width:20px;height:20px}.ai-photo-hero .hero-bg span{transition:opacity .9s ease}.ai-photo-hero .hero-bg span.is-active,.ai-photo-hero[data-active-slide="1"] .hero-bg-1,.ai-photo-hero[data-active-slide="2"] .hero-bg-2,.ai-photo-hero[data-active-slide="3"] .hero-bg-3{opacity:1!important;animation:none!important}.ai-photo-hero .ai-hero-status span.is-active{display:inline!important;opacity:1!important;animation:none!important}.ai-hero-strip{background:var(--blue);color:#fff}.ai-hero-strip .ai-strip-grid{display:grid;grid-template-columns:repeat(4,1fr)}.ai-stat{display:flex;align-items:center;gap:18px;min-height:100px;padding:22px 34px;border-left:1px solid rgba(255,255,255,.16)}.ai-stat:last-child{border-right:1px solid rgba(255,255,255,.16)}.ai-stat svg{width:32px;height:32px;color:#B9D2FF}.ai-stat strong{display:block;font-size:clamp(24px,2.2vw,32px);line-height:1;font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif}.ai-stat span{display:block;color:#D7E4FF;font-size:14px;margin-top:3px}.ai-section,section.ai-section{padding:96px 0;border:0;overflow:hidden}.ai-section-soft{background:var(--bg-soft)}.ai-section-steel{background:var(--bg-steel)}.ai-section-dark{background:var(--footer);color:#C7D2E4}.ai-section-head{max-width:760px;margin:0 0 52px}.ai-section-head.center{margin-left:auto;margin-right:auto;text-align:center}.eyebrow,.ai-eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--red);font-weight:900;font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}.eyebrow::before,.ai-eyebrow::before{content:"";width:28px;height:2px;background:var(--red)}.ai-section h2,.ai-section-title{font-family:"Barlow Semi Condensed",Barlow,Arial,sans-serif;font-size:clamp(30px,3.6vw,46px);line-height:1.06;color:var(--ink);margin:0}.ai-section-dark h2{color:#fff}.ai-section-sub{margin-top:18px;font-size:17px;color:var(--mid);line-height:1.75}.ai-grid,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:clamp(18px,3vw,32px)}.ai-card,.card{background:#fff;border:1px solid var(--line);border-radius:var(--r);box-shadow:0 1px 0 rgba(16,32,60,.04);padding:clamp(22px,2.4vw,32px);min-width:0}.ai-card h3,.card h3{margin:0 0 10px;color:var(--ink);font-size:clamp(20px,1.6vw,24px)}.ai-card p,.card p{color:var(--body);line-height:1.72}.ai-footer,.footer{background:var(--footer);color:#C7D2E4}.ai-footer-top,.footer-top{display:grid;grid-template-columns:1.3fr 1fr 1fr 1.15fr;gap:clamp(26px,4vw,56px);padding:72px 0}.ai-footer h3,.ai-footer h4,.footer h3,.footer h4{color:#fff;margin-top:0}.ai-footer ul,.footer ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ai-footer li,.footer li{display:flex;align-items:center;gap:9px;min-width:0}.ai-footer li svg,.footer li svg{width:16px;height:16px;flex:none;color:var(--red)}.ai-footer li,.ai-footer p,.footer li,.footer p{color:#C7D2E4;line-height:1.7}.ai-footer-brand{font-size:28px;font-weight:900;color:#fff}.ai-footer-brand span{color:var(--red)}.ai-footer-bottom,.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98A6BD}.to-top{float:right;color:#fff;display:inline-flex;align-items:center;gap:8px}.to-top svg{width:14px;height:14px;display:inline-block}.placeholder{background:var(--bg-soft)}.placeholder .ai-card,.placeholder .card{border-style:dashed}@media(max-width:1180px){.ai-nav-menu,.ai-header-cta,.ai-topbar-left .hide-md{display:none}.ai-menu-button{display:grid}.ai-nav{min-height:84px;position:relative}.ai-header.is-menu-open .ai-nav-menu{position:absolute;left:0;right:0;top:100%;display:flex;flex-direction:column;align-items:stretch;gap:0;background:#fff;border:1px solid var(--line);box-shadow:var(--shadow-lg);padding:8px 10px 12px;z-index:60}.ai-header.is-menu-open .ai-nav-menu li{width:100%}.ai-header.is-menu-open .ai-nav-link{height:auto;min-height:44px;padding:10px 8px;color:var(--ink)}.ai-header.is-menu-open .ai-nav-link::after{display:none}.ai-header.is-menu-open .ai-nav-item .ai-dropdown{position:static;min-width:0;opacity:1;visibility:visible;transform:none;box-shadow:none;border:1px solid var(--line);border-top:2px solid var(--red);margin:2px 0 8px}.ai-hero-strip .ai-strip-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.container,.ai-wrap{width:min(100% - 40px,680px)}.ai-topbar .container{justify-content:space-between}.ai-topbar-left{gap:12px}.ai-topbar-left .ai-contact-line:nth-child(n+2){display:none}.ai-hero{min-height:760px}.ai-hero-card{max-width:100%}.ai-hero h1{font-size:clamp(38px,12vw,54px)}.ai-actions .ai-btn,.btn-row .primary-btn,.btn-row .ghost-btn{width:100%}.ai-hero-nav{bottom:38px}.ai-stat{min-height:122px;padding:24px 20px}.ai-section,section.ai-section{padding:64px 0}.ai-footer-top,.footer-top{grid-template-columns:1fr}.ai-footer-bottom,.footer-bottom{text-align:center}.to-top{float:none;display:inline-flex;margin-top:10px}}`;
}

function aiSiteStats(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const productCount = Math.max(3, sectionArray(schema.business_taxonomy.product_categories).length);
  return [
    { icon: "icon-cube", value: "272+", label: "Projects Delivered" },
    { icon: "icon-globe", value: "12+", label: "Countries Served" },
    { icon: "icon-expertise", value: `${productCount}+`, label: "Core Product Lines" },
    { icon: "icon-building", value: "EPCM+O", label: "One-Stop Delivery" }
  ];
}

function svgUse(icon: string) {
  return `<svg aria-hidden="true"><use href="#${icon}"></use></svg>`;
}

function aiSiteChromeThemeCss(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const design = aiSiteDesignSystem(project);
  const preset = `${schema.style_requirements.preset || project.tone || ""} ${sectionArray(schema.style_requirements.keywords).join(" ")}`.toLowerCase();
  const customColors = sectionArray(schema.style_requirements.colors).length > 0;
  const brand = design.palette.brand;
  const accent = design.palette.accent;
  const deep = design.palette.brandDeep;
  const footer = design.palette.dark;
  const soft = design.palette.surface;
  const lightHeader = /clean|minimal|white|light/.test(preset);
  const darkHeader = !lightHeader && (customColors || /dark|black|luxury|tech|futur|cyber|bold/.test(preset));
  const headerBg = darkHeader ? `linear-gradient(90deg,${deep},${brand})` : "#ffffff";
  const headerText = darkHeader ? readableTextOn(deep) : design.palette.ink;
  const mutedText = darkHeader ? "rgba(255,255,255,.72)" : design.palette.muted;
  const dropdownBg = darkHeader ? "#ffffff" : "#ffffff";
  const ctaBg = darkHeader ? "rgba(255,255,255,.12)" : soft;
  return `<style data-ai-site-chrome-theme="color-only">
.ai-topbar{background:${deep};color:rgba(255,255,255,.74)}
.ai-topbar svg,.ai-footer li svg{color:${accent}}
.ai-socials a:hover{background:${accent};border-color:${accent};color:#fff}
.ai-header{background:${headerBg};border-bottom-color:${darkHeader ? "rgba(255,255,255,.12)" : design.palette.line}}
.ai-brand,.ai-nav-link,.ai-header-cta b{color:${headerText}}
.ai-brand span,.ai-eyebrow,.eyebrow{color:${accent}}
.ai-brand small,.ai-header-cta > span:not(.ai-cta-icon){color:${mutedText}}
.ai-nav-link::after,.ai-dropdown{border-top-color:${accent}}
.ai-dropdown{background:${dropdownBg}}
.ai-dropdown a::before{background:${accent}}
.ai-cta-icon{background:${ctaBg};color:${darkHeader ? "#ffffff" : brand}}
.ai-footer,.footer{background:${footer};color:rgba(255,255,255,.76)}
.ai-footer-brand span{color:${accent}}
.ai-footer-bottom,.footer-bottom{border-top-color:rgba(255,255,255,.12)}
#home.ai-photo-hero .hero-bg span::after{background:linear-gradient(90deg,${mixHexColor(deep, "#000000", 0.28)}E8,${mixHexColor(deep, "#000000", 0.12)}B8 48%,${brand}52),linear-gradient(180deg,transparent,${mixHexColor(deep, "#000000", 0.22)}A8)!important}
#home.ai-photo-hero .ai-hero-tag{background:${mixHexColor(accent, "#000000", 0.1)}42!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-hero-tag::before{background:${accent}!important;box-shadow:0 0 0 4px ${accent}55!important}
#home.ai-photo-hero .ai-btn-primary{background:${accent}!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-btn-ghost,#home.ai-photo-hero .ai-arrow{border-color:${mixHexColor(brand, "#FFFFFF", 0.42)}!important}
#home.ai-photo-hero .ai-arrow:hover{background:${accent}!important;border-color:${accent}!important;color:${readableTextOn(accent)}!important}
#home.ai-photo-hero .ai-hero-status span{color:${mixHexColor(brand, "#FFFFFF", 0.7)}!important}
</style>`;
}

function aiSiteWpThemeScript() {
  return `(() => {
  const onReady = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };
  const qsa = (root, selector) => Array.from(root.querySelectorAll(selector));

  function initMobileHeader() {
    qsa(document, ".ai-header").forEach((header) => {
      const button = header.querySelector(".ai-menu-button");
      const menu = header.querySelector(".ai-nav-menu");
      if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
      button.setAttribute("aria-expanded", "false");
      const close = () => {
        header.classList.remove("is-menu-open");
        button.setAttribute("aria-expanded", "false");
      };
      const toggle = () => {
        const open = !header.classList.contains("is-menu-open");
        header.classList.toggle("is-menu-open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
      qsa(menu, "a").forEach((link) => link.addEventListener("click", close));
      document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    });
  }

  function initHeroSliders() {
    qsa(document, ".ai-photo-hero").forEach((hero) => {
      if (!(hero instanceof HTMLElement)) return;
      const slides = qsa(hero, ".hero-bg span");
      if (!slides.length) return;
      const radios = qsa(hero, "input.hero-radio").filter((item) => item instanceof HTMLInputElement);
      const status = qsa(hero, ".ai-hero-status span");
      let index = Math.max(0, radios.findIndex((item) => item.checked));
      if (index < 0 || index >= slides.length) index = 0;
      let timer = 0;
      const setSlide = (next, manual = false) => {
        index = (next + slides.length) % slides.length;
        hero.dataset.activeSlide = String(index + 1);
        slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
        const radio = radios[index];
        if (radio instanceof HTMLInputElement) radio.checked = true;
        status.forEach((item) => {
          if (!(item instanceof HTMLElement)) return;
          const text = item.textContent || "";
          const matches = new RegExp(String(index + 1).padStart(2, "0") + "\\\\s*/").test(text) || item.classList.contains("s" + (index + 1));
          item.classList.toggle("is-active", matches);
        });
        if (manual) restart();
      };
      const restart = () => {
        if (timer) window.clearInterval(timer);
        timer = window.setInterval(() => setSlide(index + 1), 6000);
      };
      qsa(hero, ".ai-arrow[for]").forEach((control) => {
        control.addEventListener("click", () => {
          const target = String(control.getAttribute("for") || "");
          const matched = target.match(/(\\d+)$/);
          if (matched) setSlide(Number(matched[1]) - 1, true);
        });
      });
      radios.forEach((radio, radioIndex) => radio.addEventListener("change", () => setSlide(radioIndex, true)));
      setSlide(index);
      restart();
    });
  }

  function initProductsTabs() {
    qsa(document, ".products-category-showcase").forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const buttons = qsa(section, ".products-tab, [data-product-category]").filter((item) => item instanceof HTMLElement);
      if (!buttons.length) return;
      const panels = qsa(section, "[data-product-category-panel]").filter((item) => item instanceof HTMLElement);
      const cards = qsa(section, ".products-card").filter((item) => item instanceof HTMLElement);
      const updateFallbackCards = (label) => {
        cards.forEach((card, cardIndex) => {
          const title = card.querySelector("h3");
          const image = card.querySelector("img");
          const names = [
            "Standard Model",
            "Export Series",
            "Heavy Duty Assembly",
            "Custom Unit",
            "Compact Type",
            "High Flow Version",
            "Corrosion Resistant Series",
            "Project Spare Kit"
          ];
          const nextName = (label + " " + names[cardIndex % names.length]).trim();
          if (title) title.textContent = nextName.toUpperCase();
          if (image instanceof HTMLImageElement && /placehold\\.co/i.test(image.src)) {
            image.src = "https://placehold.co/560x420/f8fafc/244aa5?text=" + encodeURIComponent(nextName).replace(/%20/g, "+");
            image.alt = nextName;
          }
        });
      };
      const activate = (button) => {
        const label = String(button.getAttribute("data-product-category") || button.textContent || "").trim();
        if (!label) return;
        buttons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        let panelFound = false;
        panels.forEach((panel) => {
          const active = String(panel.getAttribute("data-product-category-panel") || "").toLowerCase() === label.toLowerCase();
          panel.hidden = !active;
          panel.classList.toggle("is-active", active);
          panelFound = panelFound || active;
        });
        if (!panelFound) updateFallbackCards(label);
        const firstPage = section.querySelector("#products-page-1");
        if (firstPage instanceof HTMLInputElement) firstPage.checked = true;
      };
      buttons.forEach((button, buttonIndex) => {
        if (!button.hasAttribute("data-product-category")) button.setAttribute("data-product-category", String(button.textContent || "").trim());
        button.setAttribute("role", "tab");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          activate(button);
        });
        if (button.classList.contains("is-active") || buttonIndex === 0) button.setAttribute("aria-selected", button.classList.contains("is-active") ? "true" : "false");
      });
      const initial = buttons.find((button) => button.classList.contains("is-active")) || buttons[0];
      activate(initial);
    });
  }

  onReady(() => {
    initMobileHeader();
    initHeroSliders();
    initProductsTabs();
  });
})();`;
}

function defaultAiSectionHtml(sectionKey: AiSiteSectionKey, project: AiSiteBuilderProject, generated = false, customPages: AiSiteCustomPageMeta[] = []) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const company = schema.company_profile;
  const contact = schema.contact_info;
  const taxonomy = schema.business_taxonomy;
  const blueprint = cleanAiSiteBlueprint(project);
  const brand = company.wordmark || company.legal_name || project.siteName || "GoodJob";
  const categories = sectionArray(taxonomy.product_categories);
  const solutions = sectionArray(taxonomy.solutions);
  const generatedBadge = generated ? "Generated" : "Blueprint";
  const sectionLabel = aiSiteSectionLabel(sectionKey, customPages);
  const text = blueprint[sectionKey] || sectionLabel;
  const frameworkCss = aiSiteFrameworkCss(project);
  const chromeThemeCss = aiSiteChromeThemeCss(project);
  const contactEmail = contact.email || "sales@example.com";
  const contactPhone = contact.phone || "+86-0000-0000";
  const contactAddress = contact.address || "Shandong, China";
  if (sectionKey === "header") {
    const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<a href="#products">${htmlEscape(item)}</a>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>${frameworkCss}</style></head><body>${aiSiteIconSprite()}${chromeThemeCss}<div class="ai-topbar"><div class="container"><div class="ai-topbar-left"><span class="ai-contact-line">${svgUse("icon-location")}${htmlEscape(contactAddress)}</span><a class="ai-contact-line hide-md" href="tel:${htmlEscape(contactPhone)}">${svgUse("icon-phone")}24/7 Engineering Support</a><a class="ai-contact-line hide-md" href="mailto:${htmlEscape(contactEmail)}">${svgUse("icon-mail")}${htmlEscape(contactEmail)}</a></div><div class="ai-topbar-right"><span>EN</span><div class="ai-socials"><a href="#" aria-label="LinkedIn">${svgUse("icon-linkedin")}</a><a href="#" aria-label="YouTube">${svgUse("icon-youtube")}</a><a href="#" aria-label="Facebook">${svgUse("icon-facebook")}</a></div></div></div></div><header class="ai-header"><div class="container ai-nav"><a class="ai-brand" href="#home">${brandWithHighlight(brand)}<small>Industrial Website</small></a><ul class="ai-nav-menu"><li><a class="ai-nav-link is-active" href="#home">Home</a></li><li class="ai-nav-item"><a class="ai-nav-link" href="#products">Products ${svgUse("icon-caret-down")}</a><div class="ai-dropdown">${productItems}</div></li><li><a class="ai-nav-link" href="#applications">Applications</a></li><li><a class="ai-nav-link" href="#about-us">About Us</a></li><li><a class="ai-nav-link" href="#blog">Blog</a></li><li><a class="ai-nav-link" href="#contact-us">Contact Us</a></li></ul><a class="ai-header-cta" href="#contact-us"><span class="ai-cta-icon">${svgUse("icon-phone")}</span><span>Get a Free Consultation<b>Contact Us</b></span></a><button class="ai-menu-button" type="button" aria-label="Menu"><i></i></button></div></header>`;
  }
  if (sectionKey === "footer") {
    const serviceItems = ["Application Matching", "Export Documentation", "Distributor Support"].map((item) => `<li>${htmlEscape(item)}</li>`).join("");
    const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
    return `${chromeThemeCss}<footer class="ai-footer"><div class="container ai-footer-top"><div><h3 class="ai-footer-brand">${brandWithHighlight(brand)}</h3><p>${htmlEscape(company.tagline || "Turnkey industrial website delivery for global B2B buyers.")}</p><p>${htmlEscape(company.description || "We help overseas buyers understand products, applications, service capability, and inquiry paths with a consistent industrial website framework.")}</p><div class="ai-socials"><a href="#" aria-label="LinkedIn">${svgUse("icon-linkedin")}</a><a href="#" aria-label="YouTube">${svgUse("icon-youtube")}</a><a href="#" aria-label="Facebook">${svgUse("icon-facebook")}</a></div></div><div><h4>Capabilities</h4><ul>${serviceItems}</ul></div><div><h4>Products</h4><ul>${productItems}</ul></div><div><h4>Contact</h4><ul><li>${svgUse("icon-location")}${htmlEscape(contactAddress)}</li><li>${svgUse("icon-mail")}${htmlEscape(contactEmail)}</li><li>${svgUse("icon-phone")}${htmlEscape(contactPhone)}</li></ul></div></div><div class="container ai-footer-bottom">&copy; ${new Date().getFullYear()} ${htmlEscape(brand)}. All rights reserved. <a href="#home" id="toTop" class="to-top">Back to top ${svgUse("icon-to-top")}</a></div></footer>`;
  }
  if (sectionKey === "hero") {
    const category = categories[0] || "Industrial Systems";
    const title = company.tagline || `${brand} ${category} Solutions for Global Buyers`;
    const eyebrow = brand.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().slice(0, 28) || "B2B INDUSTRIAL";
    return `${chromeThemeCss}<section class="ai-hero ai-photo-hero ${generated ? "" : "placeholder"}" id="home" data-hero-image-api="/api/ai-site-builder/projects/{projectId}/hero-backgrounds"><style>#home.ai-photo-hero{position:relative;min-height:72vh;color:#fff;background:#091526;overflow:hidden}#home .hero-radio{position:absolute;opacity:0;pointer-events:none}#home .hero-bg{position:absolute;inset:0;z-index:0;background:#091526}#home .hero-bg span{position:absolute;inset:0;background-position:center;background-size:cover;opacity:0;animation:heroAutoFade 18s infinite}#home .hero-bg span::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,17,32,.92),rgba(7,17,32,.66) 48%,rgba(7,17,32,.32)),linear-gradient(180deg,rgba(7,17,32,.12),rgba(7,17,32,.42))}#home .hero-bg-1{background-image:url("https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1800&q=80");animation-delay:0s}#home .hero-bg-2{background-image:url("https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1800&q=80");animation-delay:6s}#home .hero-bg-3{background-image:url("https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1800&q=80");animation-delay:12s}#home #hero-slide-1:checked~.hero-bg span,#home #hero-slide-2:checked~.hero-bg span,#home #hero-slide-3:checked~.hero-bg span{animation:none;opacity:0}#home #hero-slide-1:checked~.hero-bg .hero-bg-1,#home #hero-slide-2:checked~.hero-bg .hero-bg-2,#home #hero-slide-3:checked~.hero-bg .hero-bg-3{opacity:1}#home .ai-hero-inner{position:relative;z-index:2;min-height:72vh}#home .ai-hero-card{max-width:min(760px,72vw)}#home .ai-hero-tag{background:rgba(200,22,28,.22);border-color:rgba(200,22,28,.72);color:#ffd7d9}#home h1{max-width:820px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}#home .ai-hero-nav{left:auto;right:clamp(24px,6vw,92px);bottom:clamp(22px,4vw,48px);width:auto;z-index:4}#home .ai-hero-nav .container{width:auto;display:flex;align-items:center;gap:14px}#home .ai-hero-status span{display:none;color:#fff;font-weight:900;letter-spacing:.16em}#home .ai-hero-status .auto{display:inline-block;opacity:0;animation:heroStatusFade 18s infinite}#home .ai-hero-status .auto-2{animation-delay:6s}#home .ai-hero-status .auto-3{animation-delay:12s}#home #hero-slide-1:checked~.ai-hero-nav .s1,#home #hero-slide-2:checked~.ai-hero-nav .s2,#home #hero-slide-3:checked~.ai-hero-nav .s3{display:inline}#home #hero-slide-1:checked~.ai-hero-nav .auto,#home #hero-slide-2:checked~.ai-hero-nav .auto,#home #hero-slide-3:checked~.ai-hero-nav .auto{display:none}#home .ai-hero-arrows{display:grid;grid-template-columns:52px 52px;gap:10px}#home .ai-arrow{display:none;width:52px;height:52px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);color:#fff;place-items:center;cursor:pointer;backdrop-filter:blur(6px)}#home .hero-prev-auto,#home .hero-next-auto{display:grid}#home #hero-slide-1:checked~.ai-hero-nav .ai-arrow,#home #hero-slide-2:checked~.ai-hero-nav .ai-arrow,#home #hero-slide-3:checked~.ai-hero-nav .ai-arrow{display:none}#home #hero-slide-1:checked~.ai-hero-nav .hero-prev-1,#home #hero-slide-1:checked~.ai-hero-nav .hero-next-1,#home #hero-slide-2:checked~.ai-hero-nav .hero-prev-2,#home #hero-slide-2:checked~.ai-hero-nav .hero-next-2,#home #hero-slide-3:checked~.ai-hero-nav .hero-prev-3,#home #hero-slide-3:checked~.ai-hero-nav .hero-next-3{display:grid}@keyframes heroAutoFade{0%,30%{opacity:1}33%,100%{opacity:0}}@keyframes heroStatusFade{0%,30%{opacity:1}33%,100%{opacity:0}}@media(max-width:760px){#home.ai-photo-hero,#home .ai-hero-inner{min-height:72vh}#home .ai-hero-card{max-width:100%}#home .ai-hero-nav{right:20px;bottom:18px}#home .ai-hero-arrows{grid-template-columns:44px 44px}#home .ai-arrow{width:44px;height:44px}}</style><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-1"><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-2"><input class="hero-radio" type="radio" name="hero-bg" id="hero-slide-3"><div class="hero-bg"><span class="hero-bg-1" data-upload-slot="hero-background-1"></span><span class="hero-bg-2" data-upload-slot="hero-background-2"></span><span class="hero-bg-3" data-upload-slot="hero-background-3"></span></div><div class="container ai-hero-inner"><div class="ai-hero-card"><span class="ai-hero-tag">${htmlEscape(eyebrow)}</span><h1>${htmlEscape(title)}</h1><p>${htmlEscape(company.description || text)}</p><div class="ai-actions"><a class="ai-btn ai-btn-primary" href="#contact-us">Request a Proposal ${svgUse("icon-arrow-right")}</a><a class="ai-btn ai-btn-ghost" href="#products">Learn More</a></div></div></div><div class="ai-hero-nav"><div class="container"><div class="ai-hero-status"><span class="auto auto-1">01 / 03</span><span class="auto auto-2">02 / 03</span><span class="auto auto-3">03 / 03</span><span class="s1">01 / 03</span><span class="s2">02 / 03</span><span class="s3">03 / 03</span></div><div class="ai-hero-arrows"><label class="ai-arrow hero-prev-auto" for="hero-slide-3">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-auto" for="hero-slide-2">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-1" for="hero-slide-3">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-1" for="hero-slide-2">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-2" for="hero-slide-1">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-2" for="hero-slide-3">${svgUse("icon-arrow-next")}</label><label class="ai-arrow hero-prev-3" for="hero-slide-2">${svgUse("icon-arrow-left")}</label><label class="ai-arrow hero-next-3" for="hero-slide-1">${svgUse("icon-arrow-next")}</label></div></div></div></section>`;
  }
  if (sectionKey === "products") {
    const productCategories = (categories.length ? categories : ["Gate Valve", "Butterfly Valve", "Check Valve & Strainer", "Ball Valve", "Globe Valve", "Control Valve", "Other Valve And Fittings"]).slice(0, 8);
    const activeCategory = productCategories[Math.min(3, productCategories.length - 1)] || productCategories[0] || "Industrial Product";
    const categoryButtons = productCategories.map((item) => `<button type="button" class="products-tab${item === activeCategory ? " is-active" : ""}" data-product-category="${htmlEscape(item)}">${htmlEscape(item)}</button>`).join("");
    const productBase = activeCategory.replace(/\s*&\s*/g, " ").replace(/\s+/g, " ").trim() || "Industrial Product";
    const products = [
      `1PC ${productBase} Standard Model`,
      `2PC ${productBase} Export Series`,
      `${productBase} Heavy Duty Assembly`,
      `Stainless Steel ${productBase} Custom Unit`,
      `${productBase} OEM Compact Type`,
      `${productBase} High Flow Version`,
      `${productBase} Corrosion Resistant Series`,
      `${productBase} Project Spare Kit`
    ];
    const cardMarkup = (items: string[]) => items.map((name) => `<article class="products-card"><div class="products-image"><img src="https://placehold.co/560x420/f8fafc/244aa5?text=${encodeURIComponent(name).replace(/%20/g, "+")}" alt="${htmlEscape(name)}"></div><h3>${htmlEscape(name)}</h3><a href="#contact-us" aria-label="Request ${htmlEscape(name)}">${svgUse("icon-arrow-right")}</a></article>`).join("");
    return `<section class="ai-section products-category-showcase ${generated ? "" : "placeholder"}" id="products"><style>#products{background:#fff;padding:clamp(54px,6vw,92px) 0;overflow:hidden}#products .products-wrap{width:min(1560px,calc(100vw - clamp(34px,6vw,120px)));margin:auto}#products .products-head{text-align:center;max-width:980px;margin:0 auto clamp(28px,4vw,52px)}#products .products-head h2{font-size:clamp(36px,4.2vw,58px);line-height:1.04;margin:0 0 14px;color:#050b18}#products .products-head p{margin:0;color:#586171;font-size:clamp(15px,1.15vw,18px);line-height:1.7}#products .products-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(10px,1.4vw,18px);margin-bottom:clamp(34px,4.4vw,58px)}#products .products-tab{min-width:min(184px,100%);border:1px solid #a7acb8;border-radius:999px;background:#fff;color:#868b95;padding:12px 22px;font-weight:800;cursor:pointer}#products .products-tab.is-active{border-color:#244aa5;background:#244aa5;color:#fff}#products .products-radio{position:absolute;opacity:0;pointer-events:none}#products .products-stage{position:relative}#products .products-track{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(22px,2.8vw,38px);padding:0 clamp(34px,5vw,70px)}#products #products-page-1:checked~.products-stage .page-1,#products #products-page-2:checked~.products-stage .page-2{display:grid}#products .products-card{position:relative;background:#f5f5f6;min-width:0;padding:14px 14px 0;text-align:center;overflow:hidden}#products .products-image{background:#fff;aspect-ratio:1/1;display:grid;place-items:center;margin-bottom:22px}#products .products-image img{width:100%;height:100%;object-fit:contain;display:block}#products .products-card h3{min-height:64px;margin:0;padding:0 6px 26px;color:#111827;font-size:clamp(15px,1.1vw,18px);line-height:1.45;text-transform:uppercase;letter-spacing:.02em}#products .products-card a{position:absolute;right:0;bottom:0;width:52px;height:52px;display:grid;place-items:end;background:linear-gradient(135deg,transparent 0 49%,#244aa5 50%);color:#fff;padding:0 7px 7px 0}#products .products-card svg{width:18px;height:18px}#products .products-arrow{position:absolute;top:50%;transform:translateY(-50%);width:54px;height:74px;color:#244aa5;display:grid;place-items:center;cursor:pointer}#products .products-arrow svg{width:46px;height:46px;stroke-width:3}#products .products-arrow.prev{left:0}#products .products-arrow.next{right:0}#products .prev-1,#products .next-1,#products .prev-2,#products .next-2{display:none}#products #products-page-1:checked~.products-stage .prev-1,#products #products-page-1:checked~.products-stage .next-1,#products #products-page-2:checked~.products-stage .prev-2,#products #products-page-2:checked~.products-stage .next-2{display:grid}@media(max-width:1080px){#products .products-track{grid-template-columns:repeat(2,minmax(0,1fr));padding:0 58px}#products .products-tab{min-width:150px}}@media(max-width:760px){#products{padding:44px 0}#products .products-wrap{width:min(100% - 32px,680px)}#products .products-track{grid-template-columns:1fr;padding:0}#products .products-arrow{display:none}#products .products-tab{min-width:0;flex:1 1 150px}}</style><div class="products-wrap"><div class="products-head"><h2>Product Category</h2><p>${htmlEscape(text || `We provide ${productCategories.slice(0, 4).join(", ")} and related industrial products manufactured for global B2B purchasing standards.`)}</p></div><div class="products-tabs">${categoryButtons}</div><input class="products-radio" type="radio" name="products-page" id="products-page-1" checked><input class="products-radio" type="radio" name="products-page" id="products-page-2"><div class="products-stage"><label class="products-arrow prev prev-1" for="products-page-2" aria-label="Previous products">${svgUse("icon-arrow-left")}</label><label class="products-arrow next next-1" for="products-page-2" aria-label="Next products">${svgUse("icon-arrow-next")}</label><label class="products-arrow prev prev-2" for="products-page-1" aria-label="Previous products">${svgUse("icon-arrow-left")}</label><label class="products-arrow next next-2" for="products-page-1" aria-label="Next products">${svgUse("icon-arrow-next")}</label><div class="products-track page-1">${cardMarkup(products.slice(0, 4))}</div><div class="products-track page-2">${cardMarkup(products.slice(4, 8))}</div></div></div></section>`;
  }
  if (sectionKey === "applications") {
    const applicationItems = [
      ["Search Visibility", "Buyers search by application and specification, but thin pages miss long-tail demand.", categories[0] || "Core Products", "Capture higher-intent organic visits."],
      ["Inquiry Conversion", "Visitors need clearer trust signals, RFQ prompts, and product-fit guidance before they contact sales.", categories[1] || categories[0] || "Configured Solutions", "Turn more visits into qualified requests."],
      ["Product Selection", "Complex catalogs make it hard for overseas buyers to choose the right technical route quickly.", categories[2] || categories[0] || "Custom Options", "Shorten the path from browsing to inquiry."],
      ["Distributor Support", "Regional partners need consistent product proof, documentation, and response paths.", categories[3] || categories[0] || "Export Support", "Support faster partner evaluation."]
    ];
    const cards = applicationItems.map(([title, pain, product, outcome], index) => `<article class="applications-card"><span class="applications-index">${String(index + 1).padStart(2, "0")}</span><h3>${htmlEscape(title)}</h3><p>${htmlEscape(pain)}</p><div class="applications-chip">${htmlEscape(product)}</div><strong>${htmlEscape(outcome)}</strong></article>`).join("");
    return `<section class="ai-section applications-horizontal-card-preview ${generated ? "" : "placeholder"}" id="applications"><style>#applications{position:relative;background:linear-gradient(135deg,#f7fbff,#ffffff);padding:clamp(56px,7vw,96px) 0;color:#0b1f35;overflow:hidden}#applications .applications-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto}#applications .applications-head{display:grid;grid-template-columns:minmax(0,.85fr) minmax(260px,.45fr);gap:clamp(18px,4vw,58px);align-items:end;margin-bottom:clamp(26px,4vw,44px)}#applications .applications-eyebrow{display:inline-flex;width:max-content;margin-bottom:12px;color:#f97316;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}#applications h2{margin:0;color:#0b1f35;font-size:clamp(34px,4.2vw,58px);line-height:1.05;letter-spacing:0}#applications .applications-head p{margin:0;color:#536273;font-size:clamp(15px,1.2vw,18px);line-height:1.72}#applications .applications-row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(280px,360px);gap:clamp(16px,2.3vw,28px);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:4px 4px 18px}#applications .applications-row::-webkit-scrollbar{height:9px}#applications .applications-row::-webkit-scrollbar-thumb{background:#cbd5e1}#applications .applications-card{scroll-snap-align:start;min-width:0;background:#fff;border:1px solid #dce5ef;box-shadow:0 18px 50px rgba(11,31,53,.08);padding:clamp(22px,2.6vw,30px);display:grid;gap:14px;align-content:start}#applications .applications-index{display:grid;place-items:center;width:42px;height:42px;background:#0f4c81;color:#fff;font-weight:900}#applications .applications-card h3{margin:0;color:#0b1f35;font-size:clamp(20px,1.9vw,26px);line-height:1.18}#applications .applications-card p{margin:0;color:#536273;line-height:1.66;font-size:15px}#applications .applications-chip{width:max-content;max-width:100%;padding:8px 11px;background:#eef6ff;color:#0f4c81;border:1px solid #cfe3f7;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.06em;overflow-wrap:anywhere}#applications .applications-card strong{display:block;margin-top:2px;color:#0b1f35;line-height:1.45}#applications .applications-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:clamp(22px,3vw,34px)}#applications .applications-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 18px;background:#f97316;color:#fff;text-decoration:none;font-weight:900}#applications .applications-btn svg{width:18px;height:18px}#applications .applications-note{color:#536273;font-weight:700}@media(max-width:900px){#applications .applications-head{grid-template-columns:1fr;align-items:start}#applications .applications-row{grid-auto-columns:minmax(260px,82vw)}}@media(max-width:640px){#applications{padding:46px 0}#applications .applications-wrap{width:min(100% - 32px,680px)}#applications h2{font-size:34px}#applications .applications-row{gap:14px;padding-bottom:14px}#applications .applications-actions a{width:100%}}</style><div class="applications-wrap"><div class="applications-head"><div><span class="applications-eyebrow">Applications</span><h2>Application Paths Built Around Buyer Intent</h2></div><p>${htmlEscape(text || "Map each scenario to the product proof, content structure, and inquiry path that helps overseas buyers move from research to RFQ.")}</p></div><div class="applications-row">${cards}</div><div class="applications-actions"><a class="applications-btn" href="#contact-us">Discuss Your Application ${svgUse("icon-arrow-right")}</a><span class="applications-note">Horizontal preview cards stay readable across desktop and mobile.</span></div></div></section>`;
  }
  if (sectionKey === "contact_us") {
    const contactMethods = [
      ["icon-phone", "Phone", contactPhone],
      ["icon-mail", "Email", contactEmail],
      ["icon-location", "Location", contactAddress]
    ].map(([icon, label, value]) => `<li>${svgUse(icon)}<span>${htmlEscape(label)}</span><b>${htmlEscape(value)}</b></li>`).join("");
    const proofItems = [
      "Response within 24 hours",
      "Free technical review before quotation",
      "Export-ready documentation and delivery support",
      "Project details routed to the engineering team"
    ].map((item) => `<li>${svgUse("icon-check")}<span>${htmlEscape(item)}</span></li>`).join("");
    return `<section class="ai-section contact-inquiry-section ${generated ? "" : "placeholder"}" id="contact-us"><style>#contact-us{background:linear-gradient(135deg,#0b1f35 0%,#102f4f 48%,#f4f8fb 48%,#fff 100%);padding:clamp(56px,7vw,100px) 0;color:#fff;overflow:hidden}#contact-us .contact-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;display:grid;grid-template-columns:minmax(0,.92fr) minmax(360px,520px);gap:clamp(28px,5vw,72px);align-items:center}#contact-us .contact-copy{min-width:0;max-width:720px}#contact-us .contact-eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:16px;color:#fbbf24;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}#contact-us h2{margin:0 0 18px;font-size:clamp(34px,4.4vw,62px);line-height:1.03;letter-spacing:0;color:#fff}#contact-us .contact-intro{margin:0 0 28px;max-width:650px;color:rgba(255,255,255,.78);font-size:clamp(15px,1.2vw,18px);line-height:1.72}#contact-us .contact-methods{list-style:none;padding:0;margin:0 0 24px;display:grid;gap:10px}#contact-us .contact-methods li{display:grid;grid-template-columns:30px 78px minmax(0,1fr);gap:10px;align-items:center;min-height:46px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);padding:10px 14px}#contact-us .contact-methods svg{width:20px;height:20px;color:#fbbf24}#contact-us .contact-methods span{color:rgba(255,255,255,.62);font-size:12px;text-transform:uppercase;font-weight:800}#contact-us .contact-methods b{min-width:0;color:#fff;font-size:14px;overflow-wrap:anywhere}#contact-us .contact-proof{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#contact-us .contact-proof li{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.84);font-weight:700;line-height:1.45}#contact-us .contact-proof svg{flex:0 0 18px;width:18px;height:18px;color:#fbbf24;margin-top:2px}#contact-us .contact-form-panel{background:#fff;color:#101828;box-shadow:0 28px 80px rgba(4,12,24,.22);padding:clamp(24px,3vw,38px);border-top:5px solid #f97316}#contact-us .contact-form-panel h3{margin:0 0 8px;font-size:clamp(24px,2.4vw,34px);line-height:1.15;color:#0b1f35}#contact-us .contact-form-panel p{margin:0 0 22px;color:#667085;line-height:1.6}#contact-us .contact-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#contact-us .contact-field{display:grid;gap:7px;min-width:0}#contact-us .contact-field span{font-size:12px;font-weight:900;color:#344054;text-transform:uppercase;letter-spacing:.04em}#contact-us input,#contact-us textarea{width:100%;border:1px solid #d7dee8;background:#f8fafc;color:#101828;padding:13px 14px;font:inherit;outline:none;border-radius:0}#contact-us input:focus,#contact-us textarea:focus{border-color:#f97316;background:#fff;box-shadow:0 0 0 3px rgba(249,115,22,.14)}#contact-us .contact-field-wide{grid-column:1/-1}#contact-us textarea{min-height:128px;resize:vertical}#contact-us .contact-submit{grid-column:1/-1;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;border:0;background:#f97316;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}#contact-us .contact-submit svg{width:18px;height:18px}#contact-us .contact-note{grid-column:1/-1;margin:0;color:#667085;font-size:13px;line-height:1.55}@media(max-width:980px){#contact-us{background:#0b1f35}#contact-us .contact-wrap{grid-template-columns:1fr;align-items:start}#contact-us .contact-form-panel{max-width:680px;width:100%;justify-self:start}#contact-us .contact-proof{grid-template-columns:1fr}}@media(max-width:640px){#contact-us{padding:46px 0}#contact-us .contact-wrap{width:min(100% - 32px,680px);gap:24px}#contact-us h2{font-size:34px}#contact-us .contact-methods li{grid-template-columns:26px 1fr;gap:8px}#contact-us .contact-methods b{grid-column:2}#contact-us .contact-form{grid-template-columns:1fr}#contact-us .contact-form-panel{padding:22px}}</style><div class="contact-wrap"><div class="contact-copy"><span class="contact-eyebrow">Start Your Project</span><h2>Tell Us About Your Project Requirements</h2><p class="contact-intro">${htmlEscape(text || company.description || "Share your product needs, target market, and delivery expectations. Our team will review the details and prepare a practical proposal for your next B2B website or sourcing project.")}</p><ul class="contact-methods">${contactMethods}</ul><ul class="contact-proof">${proofItems}</ul></div><div class="contact-form-panel"><h3>Request a Free Proposal</h3><p>Your details go straight to our engineering and sales team.</p><form class="contact-form" action="#contact-us" method="post"><label class="contact-field"><span>Your name*</span><input name="name" type="text" autocomplete="name" required placeholder="Your name"></label><label class="contact-field"><span>Country</span><input name="country" type="text" autocomplete="country-name" placeholder="Your country"></label><label class="contact-field"><span>Email*</span><input name="email" type="email" autocomplete="email" required placeholder="name@company.com"></label><label class="contact-field"><span>Product / project type</span><input name="product_type" type="text" placeholder="${htmlEscape(categories[0] || "Industrial products")}"></label><label class="contact-field contact-field-wide"><span>Target capacity / quantity</span><input name="target_capacity" type="text" placeholder="e.g. 500 units per month"></label><label class="contact-field contact-field-wide"><span>Project details</span><textarea name="message" placeholder="Tell us about your project, required products, delivery schedule, and technical notes."></textarea></label><button class="contact-submit" type="submit">SEND INQUIRY ${svgUse("icon-send")}</button><p class="contact-note">This fixed inquiry form is reserved for future CRM/agent integration and can be connected to the lead pipeline later.</p></form></div></div></section>`;
  }
  if (!aiSiteSectionLabel(sectionKey)) {
    const sectionId = sectionKey.replace(/_/g, "-");
    return `<section class="ai-section custom-page-basic ${generated ? "" : "placeholder"}" id="${sectionId}"><style>#${sectionId}{background:#fff;padding:clamp(56px,7vw,96px) 0;color:#16202e}#${sectionId} .custom-page-wrap{width:min(1120px,calc(100vw - clamp(32px,6vw,120px)));margin:auto}#${sectionId} .custom-page-shell{border:1px solid #e2e7ee;background:#f8fafc;padding:clamp(28px,4vw,54px)}#${sectionId} .custom-page-eyebrow{display:inline-flex;color:#c8161c;font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:12px;margin-bottom:12px}#${sectionId} h2{margin:0 0 16px;font-size:clamp(30px,4vw,48px);line-height:1.08;color:#0c1b33}#${sectionId} p{max-width:760px;margin:0;color:#5f6b7a;font-size:clamp(15px,1.3vw,18px);line-height:1.75}#${sectionId} .custom-page-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}#${sectionId} a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:4px;background:#143a7b;color:#fff;font-weight:800;text-decoration:none}#${sectionId} a.secondary{background:#fff;color:#143a7b;border:1px solid #cfd8e6}@media(max-width:760px){#${sectionId}{padding:48px 0}#${sectionId} .custom-page-wrap{width:min(100% - 32px,680px)}#${sectionId} .custom-page-actions a{width:100%}}</style><div class="custom-page-wrap"><div class="custom-page-shell"><span class="custom-page-eyebrow">${htmlEscape(generatedBadge)}</span><h2>${htmlEscape(sectionLabel)}</h2><p>${htmlEscape(text)}</p><div class="custom-page-actions"><a href="#contact-us">Request a Proposal</a><a class="secondary" href="#products">View Products</a></div></div></div></section>`;
  }
  const panelCards = [1, 2, 3].map((index) => `<article class="ai-card"><h3>${htmlEscape(sectionLabel)} ${index}</h3><p>${htmlEscape(text)}</p></article>`).join("");
  return `<section class="ai-section ${generated ? "" : "placeholder"}" id="${sectionKey.replace(/_/g, "-")}"><div class="ai-wrap"><div class="ai-section-head"><span class="ai-eyebrow">${generatedBadge}</span><h2 class="ai-section-title">${htmlEscape(sectionLabel)}</h2><p class="ai-section-sub">${htmlEscape(text)}</p></div><div class="ai-grid">${panelCards}</div></div></section>`;
  if (sectionKey === "header") {
    const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<a href="#products">${htmlEscape(item)}</a>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--ink:#101828;--muted:#667085;--line:#e5e7eb;--brand:#3157d5;--accent:#16a34a;--bg:#ffffff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}.container{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.topbar{background:#0f172a;color:#e2e8f0;font-size:13px}.topbar .container{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.socials{display:flex;gap:12px;color:#93c5fd;flex-wrap:wrap}.header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.header .container{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:clamp(20px,1.8vw,26px);font-weight:850;white-space:nowrap}.brand span{color:var(--brand)}.nav{display:flex;align-items:center;gap:clamp(14px,1.6vw,28px);font-size:14px;flex-wrap:wrap}.nav-item{position:relative}.dropdown{display:none;position:absolute;top:28px;left:0;width:min(300px,80vw);padding:12px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 45px rgba(15,23,42,.12)}.nav-item:hover .dropdown{display:grid;gap:8px}.header-cta{display:flex;align-items:center;gap:10px;white-space:nowrap}.phone{font-weight:800;color:var(--brand)}.send-inquiry{display:none;padding:10px 14px;border-radius:4px;background:var(--brand);color:#fff;font-weight:800}section{padding:clamp(56px,7vw,112px) 0;border-bottom:1px solid #eef2f7;overflow:hidden}.eyebrow{color:var(--brand);font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.hero{background:linear-gradient(135deg,#f8fafc,#eef6ff)}.hero h1{font-size:clamp(36px,4.4vw,68px);line-height:1.05;margin:12px 0 18px;max-width:880px}.hero p{font-size:clamp(16px,1.4vw,19px);color:var(--muted);max-width:760px;line-height:1.75}.btn-row{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}.primary-btn,.ghost-btn{padding:13px 18px;border-radius:4px;font-weight:800}.primary-btn{background:var(--brand);color:white}.ghost-btn{border:1px solid var(--line);background:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:clamp(16px,2vw,30px)}.card{border:1px solid var(--line);padding:clamp(18px,2vw,28px);border-radius:6px;background:white;min-width:0}.card h3{margin:0 0 8px}.card p{color:var(--muted);line-height:1.7}.footer{background:#101828;color:#d0d5dd}.footer-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:clamp(22px,3vw,44px);padding:clamp(46px,6vw,72px) 0}.footer h3,.footer h4{color:#fff}.footer a,.footer p{color:#d0d5dd}.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98a2b3}.to-top{float:right;color:#fff}.placeholder{background:#f8fafc}.placeholder .card{border-style:dashed}@media(max-width:900px){.nav{display:none}.send-inquiry{display:inline-flex}.phone{display:none}}@media(max-width:760px){.container{width:min(100% - 36px,680px)}.topbar .container,.header .container{align-items:flex-start;justify-content:flex-start;padding:10px 0}.hero h1{font-size:36px}}
</style></head><body><div class="topbar"><div class="container"><span>Port: Qingdao / Shanghai · Global B2B Industrial Supply</span><span class="socials">LinkedIn · YouTube · Facebook</span></div></div><header class="header"><div class="container"><a class="brand" href="#home">${brandWithHighlight(brand)}</a><nav class="nav"><a href="#home">Home</a><div class="nav-item"><a href="#products">Products</a><div class="dropdown">${productItems}</div></div><a href="#applications">Applications</a><a href="#about-us">About Us</a><a href="#blog">Blog</a><a href="#contact-us">Contact Us</a></nav><div class="header-cta"><span class="phone">${htmlEscape(contact.phone || "+86-0000-0000")}</span><a class="send-inquiry" href="#contact-us">SEND INQUIRY</a></div></div></header>`;
  }
  if (sectionKey === "footer") {
    const solutionItems = (solutions.length ? solutions : ["OEM supply", "Process automation", "Distributor support"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
    const productItems = (categories.length ? categories : ["Pressure Instruments", "Temperature Instruments", "Flow Meters"]).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
    return `<footer class="footer"><div class="container footer-top"><div><h3 class="brand">${brandWithHighlight(brand)}</h3><p>${htmlEscape(company.tagline || "Reliable industrial supply for global B2B buyers.")}</p><p>${htmlEscape(company.description || "We help overseas buyers source stable industrial products with responsive service and clear documentation.")}</p></div><div><h4>Solutions</h4><ul>${solutionItems}</ul></div><div><h4>Products</h4><ul>${productItems}</ul></div><div><h4>Contact</h4><p>${htmlEscape(contact.email || "sales@example.com")}</p><p>${htmlEscape(contact.phone || "+86-0000-0000")}</p><p>${htmlEscape(contact.address || "China")}</p></div></div><div class="container footer-bottom">© ${new Date().getFullYear()} ${htmlEscape(brand)}. All rights reserved. <a href="#home" id="toTop" class="to-top">Back to top</a></div></footer></body></html>`;
  }
  const legacyText = blueprint[sectionKey as keyof ReturnType<typeof aiSiteBlueprint>] || aiSiteSectionLabel(sectionKey);
  if (sectionKey === "hero") {
    return `<section class="hero ${generated ? "" : "placeholder"}" id="home"><div class="container"><span class="eyebrow">${generatedBadge}</span><h1>${htmlEscape(company.tagline || `${brand} Industrial Solutions`)}</h1><p>${htmlEscape(legacyText)}</p><div class="btn-row"><a class="primary-btn" href="#contact-us">Send Inquiry</a><a class="ghost-btn" href="#products">View Products</a></div></div></section>`;
  }
  const cards = [1, 2, 3].map((index) => `<article class="card"><h3>${htmlEscape(aiSiteSectionLabel(sectionKey))} ${index}</h3><p>${htmlEscape(legacyText)}</p></article>`).join("");
  return `<section class="${generated ? "" : "placeholder"}" id="${sectionKey.replace(/_/g, "-")}"><div class="container"><span class="eyebrow">${generatedBadge}</span><h2>${htmlEscape(aiSiteSectionLabel(sectionKey))}</h2><div class="grid">${cards}</div></div></section>`;
}

async function ensureAiSiteSandbox(project: AiSiteBuilderProject) {
  const root = aiProjectDir(project.id);
  const sectionsDir = path.join(root, "sections");
  await mkdir(sectionsDir, { recursive: true });
  await writeFile(aiProjectMetaFile(project.id), JSON.stringify(project, null, 2), "utf8");
  await writeFile(path.join(root, "form.json"), JSON.stringify(project.schemaData || {}, null, 2), "utf8");
  const blueprintPath = path.join(root, "blueprint.json");
  const blueprintText = await readFile(blueprintPath, "utf8").catch(() => "");
  if (!blueprintText || looksCorruptAiSiteText(blueprintText)) await writeFile(blueprintPath, JSON.stringify(cleanAiSiteBlueprint(project), null, 2), "utf8");
  await writeFile(aiSiteDesignSystemFile(project.id), JSON.stringify(aiSiteDesignSystem(project), null, 2), "utf8");
  await writeFile(aiSiteVariantRegistryFile(project.id), JSON.stringify(aiSiteVariantRegistryMeta(), null, 2), "utf8");
  const orderPath = path.join(root, "order.json");
  if (!(await fileExists(orderPath))) await writeFile(orderPath, JSON.stringify(aiSiteSectionKeys, null, 2), "utf8");
  const headerPath = aiSectionFile(project.id, "header");
  const footerPath = aiSectionFile(project.id, "footer");
  await writeFile(headerPath, defaultAiSectionHtml("header", project, true), "utf8");
  await writeFile(footerPath, defaultAiSectionHtml("footer", project, true), "utf8");
}

async function persistAiSiteSettingsLocal(settings: AiSiteBuilderSetting[]) {
  await mkdir(aiBuildRoot(), { recursive: true });
  await writeFile(aiSiteSettingsFile(), JSON.stringify(settings, null, 2), "utf8");
}

function projectFromSandbox(projectId: string, schemaData: Record<string, unknown>, user: SessionUser): AiSiteBuilderProject {
  const schema = normalizeAiSiteSchemaData(schemaData);
  const company = schema.company_profile;
  const taxonomy = schema.business_taxonomy;
  const pages = ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
  return {
    id: projectId,
    taskName: `${company.legal_name || company.wordmark || "未命名网站"} 建站任务`,
    siteName: company.legal_name || company.wordmark || "未命名网站",
    industry: taxonomy.product_categories[0] || "未指定行业",
    goal: "lead-generation",
    tone: schema.style_requirements.preset || "industrial-professional",
    pages,
    schemaData: schema,
    agentPayload: normalizeAgentPayload(undefined, schema, pages),
    status: "draft_reserved",
    ownerId: user.id,
    teamId: user.teamId,
    createdAt: new Date().toISOString()
  };
}

async function hydrateAiSiteLocalState(user: SessionUser) {
  const store = getStore();
  await mkdir(aiBuildRoot(), { recursive: true });
  const localSettings = await readJsonFile<AiSiteBuilderSetting[]>(aiSiteSettingsFile(), []);
  for (const setting of localSettings) {
    if (!store.aiSiteBuilderSettings.some((item) => item.ownerId === setting.ownerId)) store.aiSiteBuilderSettings.push(setting);
  }
  for (const setting of store.aiSiteBuilderSettings) {
    if (!localSettings.some((item) => item.ownerId === setting.ownerId)) localSettings.push(setting);
  }
  if (localSettings.length) await persistAiSiteSettingsLocal(localSettings);

  const entries = await readdir(aiBuildRoot(), { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const projectId = entry.name;
    if (store.aiSiteBuilderProjects.some((item) => item.id === projectId)) continue;
    const meta = await readJsonFile<AiSiteBuilderProject | null>(aiProjectMetaFile(projectId), null);
    if (meta?.id) {
      store.aiSiteBuilderProjects.push(meta);
      continue;
    }
    const schemaData = await readJsonFile<Record<string, unknown> | null>(path.join(aiProjectDir(projectId), "form.json"), null);
    if (schemaData) {
      const restored = projectFromSandbox(projectId, schemaData, user);
      store.aiSiteBuilderProjects.push(restored);
      await ensureAiSiteSandbox(restored);
    }
  }
  for (const project of store.aiSiteBuilderProjects) await ensureAiSiteSandbox(project);
}

async function readAiSiteOrder(project: AiSiteBuilderProject) {
  await ensureAiSiteSandbox(project);
  const raw = await readFile(path.join(aiProjectDir(project.id), "order.json"), "utf8").catch(() => "[]");
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const middle = Array.isArray(parsed) ? parsed.map(String).filter((item): item is AiSiteSectionKey => isAiSiteSectionKey(item) && !aiSiteLockedSections.has(item)) : [];
  const uniqueMiddle = [...new Set(middle)];
  const fallbackMiddle = aiSiteSectionKeys.filter((item) => !aiSiteLockedSections.has(item));
  return ["header", ...(uniqueMiddle.length ? uniqueMiddle : fallbackMiddle), "footer"] as AiSiteSectionKey[];
}

async function writeAiSiteOrder(project: AiSiteBuilderProject, order: string[]) {
  const middle = order.filter((item): item is AiSiteSectionKey => isAiSiteSectionKey(item) && !aiSiteLockedSections.has(item));
  const uniqueMiddle = [...new Set(middle)];
  const fallbackMiddle = aiSiteSectionKeys.filter((item) => !aiSiteLockedSections.has(item));
  const nextOrder = ["header", ...(uniqueMiddle.length ? uniqueMiddle : fallbackMiddle), "footer"] as AiSiteSectionKey[];
  await ensureAiSiteSandbox(project);
  await writeFile(path.join(aiProjectDir(project.id), "order.json"), JSON.stringify(nextOrder, null, 2), "utf8");
  return nextOrder;
}

function sanitizeAiSiteExportFragment(html: string) {
  if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
    throw new Error("区块疑似包含 CRM 主系统内容，已拒绝导出");
  }
  return html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<svg[^>]*data-ai-site-sprite=["']xinhai-reference["'][\s\S]*?<\/svg>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\shref\s*=\s*"(?!#|mailto:|tel:)[^"]*"/gi, " href=\"#\"")
    .replace(/\shref\s*=\s*'(?!#|mailto:|tel:)[^']*'/gi, " href=\"#\"")
    .replace(/\starget\s*=\s*"[^"]*"/gi, "")
    .replace(/\starget\s*=\s*'[^']*'/gi, "")
    .trim();
}

const aiSiteWpRouteLinks: Record<string, string> = {
  "#home": "/",
  "#top": "/",
  "#products": "/products/",
  "#applications": "/applications/",
  "#about": "/about-us/",
  "#about-us": "/about-us/",
  "#about_us": "/about-us/",
  "#blog": "/blog/",
  "#news": "/blog/",
  "#contact": "/contact-us/",
  "#contact-us": "/contact-us/",
  "#contact_us": "/contact-us/"
};

function rewriteAiSiteWpRouteLinks(html: string) {
  return html.replace(/<a\b([^>]*?)\shref=(["'])(#[^"']*)\2/gi, (match, before: string, quote: string, href: string) => {
    const target = aiSiteWpRouteLinks[href.toLowerCase()];
    if (!target) return match;
    return `<a${before} href=${quote}${target}${quote}`;
  });
}

function sanitizeAiSiteWpExportFragment(html: string) {
  return rewriteAiSiteWpRouteLinks(sanitizeAiSiteExportFragment(html));
}

function buildAiSiteExportDocument(project: AiSiteBuilderProject, fragments: string[]) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const company = schema.company_profile;
  const title = company.wordmark || company.legal_name || project.siteName || "Industrial Website";
  const description = company.description || company.tagline || "B2B industrial website generated by GoodJob AI Website Factory.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><style>${aiSiteFrameworkCss(project)}</style></head><body>${aiSiteIconSprite()}${fragments.map(sanitizeAiSiteExportFragment).join("\n")}</body></html>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><style>
:root{--ink:#101828;--muted:#667085;--line:#e5e7eb;--brand:#3157d5;--accent:#16a34a;--bg:#ffffff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,"Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);overflow-x:hidden}a{color:inherit;text-decoration:none}.container{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto}.topbar{background:#0f172a;color:#e2e8f0;font-size:13px}.topbar .container{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.socials{display:flex;gap:12px;color:#93c5fd;flex-wrap:wrap}.header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.header .container{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:clamp(20px,1.8vw,26px);font-weight:850;white-space:nowrap}.brand span{color:var(--brand)}.nav{display:flex;align-items:center;gap:clamp(14px,1.6vw,28px);font-size:14px;flex-wrap:wrap}.nav-item{position:relative}.dropdown{display:none;position:absolute;top:28px;left:0;width:min(300px,80vw);padding:12px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 45px rgba(15,23,42,.12)}.nav-item:hover .dropdown{display:grid;gap:8px}.header-cta{display:flex;align-items:center;gap:10px;white-space:nowrap}.phone{font-weight:800;color:var(--brand)}.send-inquiry{display:none;padding:10px 14px;border-radius:4px;background:var(--brand);color:#fff;font-weight:800}section{padding:clamp(56px,7vw,112px) 0;border-bottom:1px solid #eef2f7;overflow:hidden}.eyebrow{color:var(--brand);font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.hero{background:linear-gradient(135deg,#f8fafc,#eef6ff)}.hero h1{font-size:clamp(36px,4.4vw,68px);line-height:1.05;margin:12px 0 18px;max-width:880px}.hero p{font-size:clamp(16px,1.4vw,19px);color:var(--muted);max-width:760px;line-height:1.75}.btn-row{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}.primary-btn,.ghost-btn{padding:13px 18px;border-radius:4px;font-weight:800}.primary-btn{background:var(--brand);color:white}.ghost-btn{border:1px solid var(--line);background:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:clamp(16px,2vw,30px)}.card{border:1px solid var(--line);padding:clamp(18px,2vw,28px);border-radius:6px;background:white;min-width:0}.card h3{margin:0 0 8px}.card p{color:var(--muted);line-height:1.7}.footer{background:#101828;color:#d0d5dd}.footer-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:clamp(22px,3vw,44px);padding:clamp(46px,6vw,72px) 0}.footer h3,.footer h4{color:#fff}.footer a,.footer p{color:#d0d5dd}.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:18px 0;color:#98a2b3}.to-top{float:right;color:#fff}.placeholder{background:#f8fafc}.placeholder .card{border-style:dashed}@media(max-width:900px){.nav{display:none}.send-inquiry{display:inline-flex}.phone{display:none}}@media(max-width:760px){.container{width:min(100% - 36px,680px)}.topbar .container,.header .container{align-items:flex-start;justify-content:flex-start;padding:10px 0}.hero h1{font-size:36px}}
</style></head><body>${fragments.map(sanitizeAiSiteExportFragment).join("\n")}</body></html>`;
}

async function exportAiSiteProject(project: AiSiteBuilderProject, orderInput?: string[]) {
  await ensureAiSiteSandbox(project);
  const order = orderInput?.length ? await writeAiSiteOrder(project, orderInput) : await readAiSiteOrder(project);
  const fragments = await Promise.all(order.map(async (sectionKey) => {
    const file = aiSectionFile(project.id, sectionKey);
    if (await fileExists(file)) return readFile(file, "utf8");
    return defaultAiSectionHtml(sectionKey, project, false);
  }));
  const distDir = aiExportDir(project.id);
  await mkdir(distDir, { recursive: true });
  const html = buildAiSiteExportDocument(project, fragments);
  const indexPath = path.join(distDir, "index.html");
  const exportedAt = new Date().toISOString();
  await writeFile(indexPath, html, "utf8");
  const customPages = await readAiSiteCustomPages(project);
  const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
  const manifest = {
    projectId: project.id,
    siteName: project.siteName,
    exportedAt,
    order,
    indexPath,
    wpMetadata
  };
  await writeFile(path.join(distDir, "export.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

function cleanAiSiteWpThemeSlug(value: unknown, fallback = "goodjob-ai-site") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

function cleanAiSiteWpHeaderValue(value: unknown, fallback: string) {
  const text = String(value ?? fallback)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return text || fallback;
}

function aiSiteWpBlockSlug(sectionKey: string) {
  return cleanAiSiteWpThemeSlug(sectionKey.replace(/_/g, "-"), "section");
}

function aiSitePhpString(value: unknown) {
  return JSON.stringify(String(value ?? ""));
}

function aiSitePhpNowdoc(identifier: string, value: string) {
  const safeIdentifier = identifier.replace(/[^A-Z0-9_]/gi, "_").toUpperCase() || "GOODJOB_HTML";
  return `<<<'${safeIdentifier}'\n${value.replace(/\r\n/g, "\n").replace(/\r/g, "\n")}\n${safeIdentifier}`;
}

function aiSiteWpFieldKey(sectionKey: string, fieldName: string) {
  return `field_goodjob_${sectionKey.replace(/[^a-z0-9_]/gi, "_")}_${fieldName}`;
}

function aiSiteWpTextFromHtml(html: string, selector: "title" | "body") {
  const source = selector === "title"
    ? html.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
    : html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  return cleanHtml((source || "").replace(/<[^>]+>/g, " ")).slice(0, selector === "title" ? 90 : 260);
}

function buildAiSiteWpAcfFieldGroup(section: AiSiteWpSectionMeta, fragment: string) {
  const sectionKey = section.section_key;
  const blockSlug = aiSiteWpBlockSlug(sectionKey);
  const title = aiSiteWpTextFromHtml(fragment, "title") || section.label;
  const intro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
  return {
    key: `group_goodjob_block_${blockSlug}`,
    title: `GoodJob Block - ${section.label}`,
    fields: [
      {
        key: aiSiteWpFieldKey(sectionKey, "eyebrow"),
        label: "Eyebrow",
        name: "eyebrow",
        type: "text",
        default_value: section.label,
        wrapper: { width: "33" }
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "title"),
        label: "Title",
        name: "title",
        type: "text",
        default_value: title,
        wrapper: { width: "67" }
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "intro"),
        label: "Intro",
        name: "intro",
        type: "textarea",
        rows: 3,
        default_value: intro
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "primary_label"),
        label: "Primary Button Label",
        name: "primary_label",
        type: "text",
        default_value: "Request a Proposal",
        wrapper: { width: "50" }
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "primary_url"),
        label: "Primary Button URL",
        name: "primary_url",
        type: "url",
        default_value: "/contact-us/",
        wrapper: { width: "50" }
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "image"),
        label: "Image",
        name: "image",
        type: "image",
        return_format: "array",
        preview_size: "medium",
        instructions: "Recommended upload size depends on the block: hero 1920x780, product 800x700, blog/case 800x600."
      },
      {
        key: aiSiteWpFieldKey(sectionKey, "html_source"),
        label: "Advanced HTML Source",
        name: "html_source",
        type: "textarea",
        rows: 12,
        instructions: "Optional. Leave empty to use structured fields or theme fallback. Use only when the exact generated section needs manual HTML editing."
      }
    ],
    location: [[{ param: "block", operator: "==", value: `acf/${blockSlug}` }]],
    menu_order: section.order_index,
    position: "normal",
    style: "default",
    label_placement: "top",
    instruction_placement: "label",
    active: true
  };
}

function buildAiSiteWpBlockJson(section: AiSiteWpSectionMeta) {
  const blockSlug = aiSiteWpBlockSlug(section.section_key);
  return {
    apiVersion: 2,
    name: `acf/${blockSlug}`,
    title: section.label,
    category: "goodjob-ai-site",
    icon: section.section_key === "hero" ? "cover-image" : section.section_key === "products" ? "products" : "layout",
    description: `${section.label} block generated by GoodJob AI Website Factory.`,
    keywords: ["goodjob", "ai-site", blockSlug],
    acf: {
      mode: "preview",
      renderTemplate: "render.php"
    },
    render: "file:./render.php",
    style: `file:./style.css`,
    attributes: {
      data: {
        type: "object",
        default: {}
      },
      mode: {
        type: "string",
        default: "preview"
      }
    },
    supports: {
      align: ["wide", "full"],
      mode: false,
      jsx: true
    }
  };
}

function buildAiSiteWpProductsHomeRender(section: AiSiteWpSectionMeta, fragment: string) {
  const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || "Product Category";
  const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || "Browse export-ready industrial products by category, compare typical models, and open a direct inquiry from the catalog.";
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'View All Products') : 'View All Products';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('product')) : get_post_type_archive_link('product');
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 8));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$products = new WP_Query(array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 8,
    'orderby' => 'menu_order date',
    'order' => 'DESC',
));
?>
<section id="products" class="ai-section goodjob-home-products goodjob-cpt-products">
  <style>
  #products.goodjob-home-products{background:#f5f7fb;padding:clamp(58px,7vw,96px) clamp(18px,4vw,54px);color:#101828}
  #products .goodjob-home-products__wrap{width:min(1440px,100%);margin:auto}
  #products .goodjob-home-products__head{text-align:center;margin:0 auto 26px;max-width:860px}
  #products .goodjob-home-products__head span{display:inline-flex;margin-bottom:10px;color:var(--blue,#244aa5);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
  #products .goodjob-home-products__head h2{margin:0 0 12px;font-size:clamp(32px,4vw,52px);line-height:1.06;color:#101828}
  #products .goodjob-home-products__head p{margin:0;color:#667085;font-size:clamp(15px,1.2vw,18px);line-height:1.72}
  #products .goodjob-home-products__terms{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:0 0 30px}
  #products .goodjob-home-products__terms a{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;background:#fff;border:1px solid #d9e1ec;color:#101828;text-decoration:none;font-weight:800}
  #products .goodjob-home-products__terms a:hover{background:var(--blue,#244aa5);border-color:var(--blue,#244aa5);color:#fff}
  #products .goodjob-home-products__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
  #products .goodjob-home-product{background:#fff;border:1px solid #d9e1ec;min-width:0;text-align:center;transition:transform .22s ease,box-shadow .22s ease}
  #products .goodjob-home-product:hover{transform:translateY(-3px);box-shadow:0 18px 34px rgba(16,32,60,.12)}
  #products .goodjob-home-product__media{position:relative;display:block;aspect-ratio:1/1;background:#f7f8fb;overflow:hidden}
  #products .goodjob-home-product__media img{width:100%;height:100%;object-fit:contain;display:block;transition:transform .32s ease}
  #products .goodjob-home-product:hover img{transform:scale(1.035)}
  #products .goodjob-home-product__arrow{position:absolute;right:18px;top:24%;width:56px;height:56px;border-radius:50%;background:var(--blue,#244aa5);color:#fff;display:grid;place-items:center;font-size:30px;box-shadow:0 0 0 7px rgba(255,255,255,.86);opacity:0;transform:translateX(10px);transition:.22s ease}
  #products .goodjob-home-product:hover .goodjob-home-product__arrow{opacity:1;transform:none}
  #products .goodjob-home-product h3{margin:0;min-height:78px;padding:16px 16px 18px;display:grid;place-items:center;font-size:18px;line-height:1.18;font-weight:700}
  #products .goodjob-home-product h3 a{color:#101828;text-decoration:none}
  #products .goodjob-home-products__actions{display:flex;justify-content:center;margin-top:30px}
  #products .goodjob-home-products__actions a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900}
  #products .goodjob-home-products__empty{padding:24px;background:#fff;border:1px dashed #cbd5e1;color:#667085;text-align:center}
  @media(max-width:1100px){#products .goodjob-home-products__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:640px){#products.goodjob-home-products{padding:42px 16px}#products .goodjob-home-products__grid{grid-template-columns:1fr}#products .goodjob-home-product__arrow{opacity:1;transform:none;width:48px;height:48px;font-size:26px}}
  </style>
  <div class="goodjob-home-products__wrap">
    <div class="goodjob-home-products__head">
      <span>Product Category</span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
    </div>
    <?php if (!empty($terms)) : ?>
      <nav class="goodjob-home-products__terms" aria-label="Product categories">
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </nav>
    <?php endif; ?>
    <?php if ($products->have_posts()) : ?>
      <div class="goodjob-home-products__grid">
        <?php while ($products->have_posts()) : $products->the_post();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
          <article class="goodjob-home-product">
            <a class="goodjob-home-product__media" href="<?php the_permalink(); ?>">
              <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              <span class="goodjob-home-product__arrow" aria-hidden="true">&#8594;</span>
            </a>
            <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
          </article>
        <?php endwhile; wp_reset_postdata(); ?>
      </div>
    <?php else : ?>
      <p class="goodjob-home-products__empty">No products are published yet. Add Products in the WordPress admin panel.</p>
    <?php endif; ?>
    <div class="goodjob-home-products__actions">
      <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('product')); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>`;
}

function buildAiSiteWpBlogHomeRender(section: AiSiteWpSectionMeta, fragment: string) {
  const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || "Recent Blogs";
  const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || "Read practical product guides, maintenance notes, and export buying insights from the latest News CPT content.";
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'More Blogs') : 'More Blogs';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('news')) : get_post_type_archive_link('news');
$news_query = new WP_Query(array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 5,
    'orderby' => 'date',
    'order' => 'DESC',
));
$featured_id = 0;
?>
<section id="blog" class="ai-section goodjob-home-blog goodjob-cpt-blog">
  <style>
  #blog.goodjob-home-blog{background:#fff;padding:clamp(62px,8vw,108px) clamp(18px,5vw,72px);color:#101828}
  #blog .goodjob-home-blog__wrap{width:min(1440px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,.9fr) minmax(360px,1fr);gap:clamp(30px,5vw,72px);align-items:start}
  #blog .goodjob-home-blog__intro span{display:inline-flex;margin-bottom:12px;color:var(--blue,#244aa5);font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:12px}
  #blog .goodjob-home-blog__intro h2{margin:0 0 16px;color:#101828;font-size:clamp(34px,4.4vw,60px);line-height:1.02;text-transform:uppercase}
  #blog .goodjob-home-blog__intro p{margin:0 0 26px;color:#667085;font-size:clamp(15px,1.2vw,18px);line-height:1.74;max-width:620px}
  #blog .goodjob-featured-post{border:1px solid #d9e1ec;background:#f7f8fb;overflow:hidden}
  #blog .goodjob-featured-post__media{display:block;aspect-ratio:16/9;background:#eef2f7;overflow:hidden}
  #blog .goodjob-featured-post__media img{width:100%;height:100%;object-fit:cover;display:block}
  #blog .goodjob-featured-post__body{padding:clamp(20px,3vw,30px);background:#fff}
  #blog .goodjob-featured-post time,#blog .goodjob-blog-row time{display:block;color:#98a2b3;font-size:14px;margin-bottom:10px}
  #blog .goodjob-featured-post h3{margin:0 0 12px;font-size:clamp(24px,2.6vw,34px);line-height:1.12}
  #blog .goodjob-featured-post h3 a,#blog .goodjob-blog-row h3 a{color:var(--blue,#244aa5);text-decoration:none}
  #blog .goodjob-featured-post p,#blog .goodjob-blog-row p{margin:0;color:#344054;line-height:1.68}
  #blog .goodjob-blog-list__head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
  #blog .goodjob-blog-list__head h3{margin:0;color:#101828;font-size:clamp(24px,2.8vw,36px);line-height:1;text-transform:uppercase}
  #blog .goodjob-blog-list__head a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900}
  #blog .goodjob-blog-rows{display:grid;gap:0}
  #blog .goodjob-blog-row{display:grid;grid-template-columns:132px minmax(0,1fr);gap:18px;padding:22px 0;border-bottom:1px solid #e4e7ec}
  #blog .goodjob-blog-row__media{display:block;aspect-ratio:4/3;background:#f3f5f8;overflow:hidden;border:1px solid #e4e7ec}
  #blog .goodjob-blog-row__media img{width:100%;height:100%;object-fit:cover;display:block}
  #blog .goodjob-blog-row h3{margin:0 0 9px;font-size:21px;line-height:1.18}
  #blog .goodjob-home-blog__empty{grid-column:1/-1;padding:24px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
  @media(max-width:980px){#blog .goodjob-home-blog__wrap{grid-template-columns:1fr}#blog .goodjob-blog-list__head{align-items:flex-start;flex-direction:column}}
  @media(max-width:560px){#blog.goodjob-home-blog{padding:42px 16px}#blog .goodjob-blog-row{grid-template-columns:1fr}#blog .goodjob-blog-list__head a{width:100%}}
  </style>
  <?php if ($news_query->have_posts()) : ?>
    <div class="goodjob-home-blog__wrap">
      <div class="goodjob-home-blog__intro">
        <span>Recent Blogs</span>
        <h2><?php echo esc_html($title); ?></h2>
        <p><?php echo esc_html($intro); ?></p>
        <?php $news_query->the_post(); $featured_id = get_the_ID();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/960x540/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
        <article class="goodjob-featured-post">
          <a class="goodjob-featured-post__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="goodjob-featured-post__body">
            <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
            <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 28)); ?></p>
          </div>
        </article>
      </div>
      <div class="goodjob-home-blog__list">
        <div class="goodjob-blog-list__head">
          <h3>More Blogs</h3>
          <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('news')); ?>"><?php echo esc_html($primary_label); ?></a>
        </div>
        <div class="goodjob-blog-rows">
          <?php while ($news_query->have_posts()) : $news_query->the_post();
            if (get_the_ID() === $featured_id) {
                continue;
            }
            $row_image = get_the_post_thumbnail_url(get_the_ID(), 'medium_large');
            if (!$row_image) {
                $row_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$row_image) {
                $row_image = 'https://placehold.co/420x300/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="goodjob-blog-row">
              <a class="goodjob-blog-row__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($row_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              </a>
              <div>
                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
                <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 20)); ?></p>
              </div>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
        </div>
      </div>
    </div>
  <?php else : ?>
    <p class="goodjob-home-blog__empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p>
  <?php endif; ?>
</section>`;
}

function buildAiSiteWpBlockRender(section: AiSiteWpSectionMeta, fragment: string) {
  if (section.section_key === "products") return buildAiSiteWpProductsHomeRender(section, fragment);
  if (section.section_key === "blog") return buildAiSiteWpBlogHomeRender(section, fragment);
  const blockSlug = aiSiteWpBlockSlug(section.section_key);
  const sectionId = section.section_key === "hero" ? "home" : section.section_key.replace(/_/g, "-");
  const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || section.label;
  const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
  const fallbackPrimaryLabel = section.section_key === "contact_us" ? "Send Inquiry" : "Request a Proposal";
  const fallbackPrimaryUrl = "/contact-us/";
  const defaultHtml = aiSitePhpNowdoc(`GOODJOB_${blockSlug}_HTML`, fragment);
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = ${defaultHtml};
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: ${aiSitePhpString(section.label)}) : ${aiSitePhpString(section.label)};
$title = function_exists('get_field') ? (get_field('title') ?: ${aiSitePhpString(fallbackTitle)}) : ${aiSitePhpString(fallbackTitle)};
$intro = function_exists('get_field') ? (get_field('intro') ?: ${aiSitePhpString(fallbackIntro)}) : ${aiSitePhpString(fallbackIntro)};
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: ${aiSitePhpString(fallbackPrimaryLabel)}) : ${aiSitePhpString(fallbackPrimaryLabel)};
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: ${aiSitePhpString(fallbackPrimaryUrl)}) : ${aiSitePhpString(fallbackPrimaryUrl)};
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$has_structured_edits = $image_url
    || $eyebrow !== ${aiSitePhpString(section.label)}
    || $title !== ${aiSitePhpString(fallbackTitle)}
    || $intro !== ${aiSitePhpString(fallbackIntro)}
    || $primary_label !== ${aiSitePhpString(fallbackPrimaryLabel)}
    || $primary_url !== ${aiSitePhpString(fallbackPrimaryUrl)};
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== ${aiSitePhpString(section.label)}) {
        $editable_html = preg_replace_callback("/<(span|div)\\\\b([^>]*class=[\\"'][^\\"']*(?:eyebrow|badge|tag)[^\\"']*[\\"'][^>]*)>.*?<\\\\/\\\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== ${aiSitePhpString(fallbackTitle)}) {
        $editable_html = preg_replace_callback('/<h([1-3])\\b([^>]*)>.*?<\\/h\\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== ${aiSitePhpString(fallbackIntro)}) {
        $editable_html = preg_replace_callback('/<p\\b([^>]*)>.*?<\\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== ${aiSitePhpString(fallbackPrimaryLabel)} || $primary_url !== ${aiSitePhpString(fallbackPrimaryUrl)}) {
        $editable_html = preg_replace_callback("/<a\\\\b([^>]*?)href=([\\"']).*?\\\\2([^>]*)>.*?<\\\\/a>/is", function ($matches) use ($primary_label, $primary_url) {
            return '<a' . $matches[1] . 'href="' . esc_url($primary_url) . '"' . $matches[3] . '>' . esc_html($primary_label) . '</a>';
        }, $editable_html, 1) ?: $editable_html;
    }
    echo $editable_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
?>
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('${blockSlug}'); ?>" id="<?php echo esc_attr('${sectionId}'); ?>">
  <div class="ai-wrap goodjob-acf-block__inner">
    <?php if ($image_url) : ?>
      <div class="goodjob-acf-block__media"><img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($title); ?>" loading="lazy" decoding="async"></div>
    <?php endif; ?>
    <div class="goodjob-acf-block__content">
      <span class="ai-eyebrow"><?php echo esc_html($eyebrow); ?></span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
      <a class="ai-btn ai-btn-primary" href="<?php echo esc_url($primary_url); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>
`;
}

function buildAiSiteWpBlockStyle(section: AiSiteWpSectionMeta) {
  const blockSlug = aiSiteWpBlockSlug(section.section_key);
  return `.goodjob-acf-block-${blockSlug}{background:var(--bg,#fff);padding:clamp(58px,7vw,104px) 0}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__inner{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.72fr);gap:clamp(26px,4vw,64px);align-items:center}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__media{aspect-ratio:16/10;background:#eef2f7;overflow:hidden}
.goodjob-acf-block-${blockSlug} .goodjob-acf-block__media img{width:100%;height:100%;object-fit:cover;display:block}
.goodjob-acf-block-${blockSlug} h2{margin:0 0 16px;color:var(--ink,#16202e);font-size:clamp(32px,4vw,52px);line-height:1.06}
.goodjob-acf-block-${blockSlug} p{color:var(--body,#3c4858);font-size:clamp(16px,1.3vw,19px);line-height:1.76;margin:0 0 24px}
@media(max-width:900px){.goodjob-acf-block-${blockSlug} .goodjob-acf-block__inner{grid-template-columns:1fr}.goodjob-acf-block-${blockSlug} .goodjob-acf-block__content{order:-1}}`;
}

function buildAiSiteWpPageBlock(section: AiSiteWpSectionMeta, fragment: string) {
  const blockSlug = aiSiteWpBlockSlug(section.section_key);
  const fallbackTitle = aiSiteWpTextFromHtml(fragment, "title") || section.label;
  const fallbackIntro = aiSiteWpTextFromHtml(fragment, "body") || `${section.label} section content generated by GoodJob AI Website Factory.`;
  const attrs = {
    name: `acf/${blockSlug}`,
    data: {
      eyebrow: section.label,
      _eyebrow: aiSiteWpFieldKey(section.section_key, "eyebrow"),
      title: fallbackTitle,
      _title: aiSiteWpFieldKey(section.section_key, "title"),
      intro: fallbackIntro,
      _intro: aiSiteWpFieldKey(section.section_key, "intro"),
      primary_label: section.section_key === "contact_us" ? "Send Inquiry" : "Request a Proposal",
      _primary_label: aiSiteWpFieldKey(section.section_key, "primary_label"),
      primary_url: "/contact-us/",
      _primary_url: aiSiteWpFieldKey(section.section_key, "primary_url"),
      html_source: "",
      _html_source: aiSiteWpFieldKey(section.section_key, "html_source")
    },
    mode: "preview"
  };
  return `<!-- wp:acf/${blockSlug} ${JSON.stringify(attrs)} /-->`;
}

function buildAiSiteWpCollections(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const categories = sectionArray(schema.business_taxonomy.product_categories);
  const productCategories = (categories.length ? categories : ["Gate Valve", "Butterfly Valve", "Check Valve & Strainer", "Ball Valve", "Globe Valve", "Control Valve", "Other Valve And Fittings"]).slice(0, 10);
  const brand = schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName || "GoodJob";
  const primaryMarket = project.industry || schema.company_profile.tagline || "global industrial buyers";
  const productNameSuffixes = [
    "Ductile Iron Wafer Type",
    "Lug Type With Handle",
    "Double Stem Lug Type",
    "Flanged Gear Operated",
    "Stainless Steel Industrial",
    "Compact OEM Series",
    "Resilient Seated Model",
    "Heavy Duty Export Type"
  ];
  const genericProductSuffixes = [
    "Standard Export Model",
    "Precision OEM Series",
    "Heavy Duty Assembly",
    "Custom Manufacturing Unit",
    "Industrial Supply Version",
    "High Stability Project Type",
    "Inspection Ready Series",
    "Distributor Stock Option"
  ];
  const productImageColor = ["244aa5", "1f57b7", "2f6fc6", "315f9f", "4878d0", "113a7c"];
  const makeProductItems = (count: number) => Array.from({ length: count }, (_, index) => {
    const category = productCategories[index % productCategories.length] || "Industrial Products";
    const isValveCategory = /valve|strainer|fitting/i.test(category);
    const suffix = isValveCategory ? productNameSuffixes[index % productNameSuffixes.length] : genericProductSuffixes[index % genericProductSuffixes.length];
    const title = isValveCategory ? `${suffix} ${category}`.replace(/\s+/g, " ").trim() : `${category} ${suffix}`.replace(/\s+/g, " ").trim();
    const desc = `${brand} supplies ${category.toLowerCase()} options for industrial fluid control projects, with model confirmation, inspection records, export packing, and responsive RFQ support.`;
    const material = ["Carbon steel", "Stainless steel", "Aluminum alloy", "Custom alloy"][index % 4];
    const application = ["OEM assembly", "Process equipment", "Automation line", "Maintenance replacement"][index % 4];
    const imageText = encodeURIComponent(category.replace(/&/g, "and")).replace(/%20/g, "+");
    const image = `https://placehold.co/640x520/f6f8fb/${productImageColor[index % productImageColor.length]}?text=${imageText}`;
    return {
      title,
      desc,
      category,
      image,
      sku: `GJ-${String(index + 1).padStart(3, "0")}`,
      material,
      application,
      lead_time: "15-35 days after drawing or sample confirmation",
      export_docs: "Commercial invoice, packing list, certificate, inspection record",
      content: `<h2>${htmlEscape(title)} Overview</h2>
<p>${htmlEscape(desc)}</p>
<h3>Typical Specifications</h3>
<table><tbody>
<tr><th>Category</th><td>${htmlEscape(category)}</td></tr>
<tr><th>Material</th><td>${htmlEscape(material)}</td></tr>
<tr><th>Application</th><td>${htmlEscape(application)}</td></tr>
<tr><th>Lead Time</th><td>15-35 days after drawing or sample confirmation</td></tr>
<tr><th>Export Documents</th><td>Commercial invoice, packing list, certificate, inspection record</td></tr>
</tbody></table>
<h3>Inquiry Checklist</h3>
<ul><li>Drawing, sample photo, or target model</li><li>Quantity and delivery market</li><li>Material, surface treatment, and tolerance requirements</li></ul>`
    };
  });
  const caseCategories = ["Factory Upgrade", "Distributor Program", "OEM Supply", "Process Optimization"];
  const newsCategories = ["Selection Guides", "Maintenance", "Materials", "Export Notes"];
  return {
    product: {
      label: "Products",
      taxonomy: "Product Categories",
      items: makeProductItems(Math.max(8, productCategories.length * 3))
    },
    service: {
      label: "Services",
      taxonomy: "Service Categories",
      items: [
        { title: "Application Matching", desc: "Match products to operating conditions, buyer requirements, and target markets.", category: "Pre-sales", image: "", deliverables: "Selection notes, model shortlist, inquiry checklist", content: "<h2>Application Matching</h2><p>We translate buyer requirements into product selections, technical questions, and a sourcing path that can be confirmed quickly.</p><ul><li>Operating condition review</li><li>Model and material shortlist</li><li>RFQ checklist for faster quotation</li></ul>" },
        { title: "Export Documentation", desc: "Support datasheets, certificates, packing details, and shipment documents.", category: "Export", image: "", deliverables: "Datasheets, certificates, packing list, shipment notes", content: "<h2>Export Documentation</h2><p>Documentation is prepared around foreign trade expectations so procurement, customs, and buyer approval steps move with fewer avoidable delays.</p><ul><li>Datasheet and certificate preparation</li><li>Packing and label information</li><li>Shipment document coordination</li></ul>" },
        { title: "Distributor Support", desc: "Prepare catalogs, technical content, and inquiry follow-up materials for channel partners.", category: "Channel", image: "", deliverables: "Catalog structure, product copy, inquiry follow-up scripts", content: "<h2>Distributor Support</h2><p>Channel partners receive structured product information, localized selling points, and practical follow-up materials for repeated inquiry handling.</p><ul><li>Catalog and category planning</li><li>Sales copy and FAQ support</li><li>Repeat inquiry workflow</li></ul>" },
        { title: "After-sales Coordination", desc: "Keep repeat orders, revisions, replenishment, and warranty communication organized.", category: "Support", image: "", deliverables: "Revision record, replenishment plan, after-sales communication log", content: "<h2>After-sales Coordination</h2><p>After the first order, we keep replacement, revision, and replenishment communication organized so buyers can reorder with confidence.</p><ul><li>Revision and reorder tracking</li><li>Warranty communication support</li><li>Repeat shipment coordination</li></ul>" }
      ]
    },
    case: {
      label: "Cases",
      taxonomy: "Case Categories",
      items: Array.from({ length: Math.max(4, productCategories.length) }, (_, index) => {
        const category = productCategories[index % productCategories.length] || "Industrial Products";
        const title = `${category} Export Project ${index + 1}`;
        const desc = `${brand} delivered ${category.toLowerCase()} support for an overseas industrial customer, combining technical review, stable quality checks, and responsive export communication.`;
        const region = ["Europe", "Middle East", "South America", "Southeast Asia"][index % 4];
        return {
          title,
          desc,
          category: caseCategories[index % caseCategories.length],
          image: "",
          region,
          challenge: "The buyer needed clearer technical confirmation, predictable documents, and a faster quotation path.",
          solution: `${brand} organized the inquiry details, checked product requirements, and prepared export-ready communication for ${primaryMarket}.`,
          result: "The project moved from inquiry to confirmed specification with fewer repeated questions and a cleaner handoff.",
          content: `<h2>Project Background</h2><p>${htmlEscape(desc)}</p><h3>Challenge</h3><p>The buyer needed clearer technical confirmation, predictable documents, and a faster quotation path.</p><h3>Solution</h3><p>${htmlEscape(brand)} organized the inquiry details, checked product requirements, and prepared export-ready communication for ${htmlEscape(primaryMarket)}.</p><h3>Result</h3><p>The project moved from inquiry to confirmed specification with fewer repeated questions and a cleaner handoff.</p>`
        };
      })
    },
    news: {
      label: "News",
      taxonomy: "News Categories",
      items: Array.from({ length: Math.max(8, productCategories.length * 2) }, (_, index) => {
        const category = productCategories[index % productCategories.length] || "Industrial Products";
        const firstBlogTitle = /s$/i.test(category) ? `What Buyers Should Know About ${category}` : `What Is a ${category} and How Does It Work?`;
        const blogTitles = [
          firstBlogTitle,
          `${category} Selection Guide for Industrial Piping Projects`,
          `Resilient Seated vs Metal Seated ${category}: Key Differences`,
          `${category} Maintenance Checklist for Export Buyers`,
          `How to Prepare an RFQ for ${category} Suppliers`,
          `${category} Materials, Pressure Ratings, and Inspection Notes`,
          `Common ${category} Applications in Fluid Control Systems`,
          `How Packaging and Documentation Affect ${category} Delivery`
        ];
        const title = blogTitles[index % blogTitles.length];
        const desc = `Practical notes for sourcing ${category.toLowerCase()} in international industrial procurement, covering selection logic, documentation, inspection, and inquiry preparation.`;
        const imageText = encodeURIComponent(category.replace(/&/g, "and")).replace(/%20/g, "+");
        return {
          title,
          desc,
          category: newsCategories[index % newsCategories.length],
          image: `https://placehold.co/640x360/e9edf4/244aa5?text=${imageText}`,
          date: new Date(Date.now() - index * 3 * 86400000).toISOString().slice(0, 10),
          content: `<h2>${htmlEscape(title)}</h2><p>${htmlEscape(desc)}</p><h3>What buyers should confirm first</h3><ul><li>Operating environment and technical standard</li><li>Quantity, packaging, and delivery market</li><li>Inspection, certificate, and documentation needs</li></ul><h3>How ${htmlEscape(brand)} supports the inquiry</h3><p>We turn early inquiry information into a clearer RFQ path so technical review, quotation, and export coordination can happen faster.</p>`
        };
      })
    }
  };
}

function buildAiSiteWpSiteOptions(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  return {
    site_name: project.siteName,
    company: schema.company_profile,
    contact: schema.contact_info,
    social_links: schema.social_links,
    style_requirements: schema.style_requirements
  };
}

function buildAiSiteWpRouteBlueprint(project: AiSiteBuilderProject) {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const categories = sectionArray(schema.business_taxonomy.product_categories);
  return {
    version: "1.0",
    mode: "multi-route-block-theme",
    note: "Static pages are assembled from ACF blocks. List/detail routes are backed by native WordPress CPT data seeded from collections.json.",
    nav: [
      { label: "Home", route_type: "page", slug: "home", source: "pages.home" },
      { label: "Products", route_type: "archive", post_type: "product", slug: "products", source: "collections.product" },
      { label: "Applications", route_type: "page", slug: "applications", source: "pages.applications" },
      { label: "About Us", route_type: "page", slug: "about-us", source: "pages.about_us" },
      { label: "Blog", route_type: "archive", post_type: "news", slug: "blog", source: "collections.news" },
      { label: "Contact Us", route_type: "page", slug: "contact-us", source: "pages.contact_us" }
    ],
    cpt_routes: {
      product: {
        archive: "/products/",
        taxonomy: "/product-category/{term}/",
        single: "/products/{post}/",
        data_source: "collections.product",
        required_templates: ["archive-product.html", "taxonomy-product_cat.html", "single-product.html"],
        seed_count: Math.max(8, categories.length * 3)
      },
      case: {
        archive: "/cases/",
        taxonomy: "/case-category/{term}/",
        single: "/cases/{post}/",
        data_source: "collections.case",
        required_templates: ["archive-case.html", "taxonomy-case_cat.html", "single-case.html"],
        seed_count: Math.max(4, categories.length)
      },
      news: {
        archive: "/blog/",
        taxonomy: "/news-category/{term}/",
        single: "/blog/{post}/",
        data_source: "collections.news",
        required_templates: ["archive-news.html", "taxonomy-news_cat.html", "single-news.html"],
        seed_count: Math.max(6, categories.length * 2)
      },
      service: {
        archive: "/services/",
        taxonomy: "/service-category/{term}/",
        single: "/services/{post}/",
        data_source: "collections.service",
        required_templates: ["archive-service.html", "taxonomy-service_cat.html", "single-service.html"],
        seed_count: 4
      }
    },
    static_pages: {
      home: ["hero", "products", "applications", "about_us", "blog", "contact_us"],
      applications: ["applications", "products", "contact_us"],
      about_us: ["about_us", "applications", "contact_us"],
      contact_us: ["contact_us"],
      thanks: ["contact_us"]
    }
  };
}

function buildAiSiteWpTemplateShell(content: string) {
  return `<!-- wp:template-part {"slug":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group">
${content}
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer"} /-->`;
}

function buildAiSiteWpArchiveTemplate(config: { title: string; intro: string; cpt: string; mediaRatio: string; tone: "product" | "case" | "news" | "service" | "generic" }) {
  const toneClass = `goodjob-archive--${config.tone}`;
  return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-archive ${toneClass}","layout":{"type":"constrained","contentSize":"1440px"}} -->
<section class="wp-block-group goodjob-archive ${toneClass}">
  <!-- wp:group {"className":"goodjob-archive__head","layout":{"type":"constrained","contentSize":"920px"}} -->
  <div class="wp-block-group goodjob-archive__head">
    <!-- wp:query-title {"type":"archive","level":1} /-->
    <!-- wp:paragraph --><p>${htmlEscape(config.intro)}</p><!-- /wp:paragraph -->
  </div>
  <!-- /wp:group -->
  <!-- wp:query {"query":{"perPage":12,"pages":0,"offset":0,"postType":"${config.cpt}","order":"desc","orderBy":"date","inherit":true},"displayLayout":{"type":"flex","columns":3},"className":"goodjob-archive__query"} -->
  <div class="wp-block-query goodjob-archive__query">
    <!-- wp:post-template className="goodjob-archive__grid" -->
      <!-- wp:group {"className":"goodjob-card","layout":{"type":"constrained"}} -->
      <article class="wp-block-group goodjob-card">
        <!-- wp:post-featured-image {"isLink":true,"aspectRatio":"${config.mediaRatio}","className":"goodjob-card__media"} /-->
        <!-- wp:post-terms {"term":"${config.cpt === "product" ? "product_cat" : config.cpt === "case" ? "case_cat" : config.cpt === "news" ? "news_cat" : config.cpt === "service" ? "service_cat" : "category"}","className":"goodjob-card__terms"} /-->
        <!-- wp:post-title {"isLink":true,"level":2,"className":"goodjob-card__title"} /-->
        <!-- wp:post-excerpt {"moreText":"View Details","className":"goodjob-card__excerpt"} /-->
      </article>
      <!-- /wp:group -->
    <!-- /wp:post-template -->
    <!-- wp:query-pagination {"className":"goodjob-pagination","layout":{"type":"flex","justifyContent":"center"}} -->
      <!-- wp:query-pagination-previous /-->
      <!-- wp:query-pagination-numbers /-->
      <!-- wp:query-pagination-next /-->
    <!-- /wp:query-pagination -->
    <!-- wp:query-no-results -->
      <!-- wp:paragraph --><p>No items have been published yet. Add content in the WordPress admin panel to populate this route.</p><!-- /wp:paragraph -->
    <!-- /wp:query-no-results -->
  </div>
  <!-- /wp:query -->
</section>
<!-- /wp:group -->`);
}

function buildAiSiteWpProductsArchiveTemplate() {
  return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/products-archive /-->`);
}

function buildAiSiteWpBlogArchiveTemplate() {
  return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/blog-archive /-->`);
}

function buildAiSiteWpNativeArchiveBlockJson(name: "products-archive" | "blog-archive" | "product-detail" | "news-detail", title: string, icon: string) {
  return {
    apiVersion: 2,
    name: `goodjob-ai-site/${name}`,
    title,
    category: "goodjob-ai-site",
    icon,
    description: `${title} dynamic CPT archive block generated by GoodJob AI Website Factory.`,
    render: "file:./render.php",
    style: "file:./style.css",
    supports: {
      html: false,
      align: ["wide", "full"]
    }
  };
}

function buildAiSiteWpProductsArchiveRender() {
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('product_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$query_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 12,
    'orderby' => 'menu_order date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$products = new WP_Query($query_args);
?>
<section class="goodjob-products-page">
  <div class="goodjob-products-page__wrap">
    <aside class="goodjob-products-sidebar" aria-label="Product categories">
      <h1>Products Categories</h1>
      <nav>
        <a class="<?php echo $current_term_id ? '' : 'is-active'; ?>" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">All Products</a>
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a class="<?php echo ((int) $term->term_id === $current_term_id) ? 'is-active' : ''; ?>" href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </nav>
    </aside>
    <div class="goodjob-products-main">
      <div class="goodjob-products-main__head">
        <span>Product Center</span>
        <h2><?php echo esc_html($current_term_id && $current_term ? $current_term->name : 'Industrial Product Catalog'); ?></h2>
        <p>Browse product categories, compare typical models, and open a direct inquiry for drawings, pricing, and export documents.</p>
      </div>
      <?php if ($products->have_posts()) : ?>
        <div class="goodjob-product-grid">
          <?php while ($products->have_posts()) : $products->the_post();
            $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
            if (!$image_url) {
                $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$image_url) {
                $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="goodjob-product-card">
              <a class="goodjob-product-card__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
                <span aria-hidden="true">→</span>
              </a>
              <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
        </div>
      <?php else : ?>
        <p class="goodjob-products-empty">No products are published yet. Add Products in the WordPress admin panel.</p>
      <?php endif; ?>
    </div>
  </div>
</section>`;
}

function buildAiSiteWpBlogArchiveRender() {
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('news_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$query_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 10,
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$news_query = new WP_Query($query_args);
?>
<section class="goodjob-blog-page">
  <header class="goodjob-blog-hero">
    <div class="goodjob-blog-hero__shade"></div>
    <h1><?php echo is_tax('news_cat') ? esc_html(single_term_title('', false)) : 'Blog'; ?></h1>
  </header>
  <nav class="goodjob-blog-breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">›</span>
    <span>Blog</span>
  </nav>
  <div class="goodjob-blog-list">
    <?php if ($news_query->have_posts()) : ?>
      <?php while ($news_query->have_posts()) : $news_query->the_post();
        $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
        if (!$image_url) {
            $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$image_url) {
            $image_url = 'https://placehold.co/640x360/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article class="goodjob-blog-item">
          <a class="goodjob-blog-item__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="goodjob-blog-item__body">
            <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
            <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
            <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 26)); ?></p>
            <a class="goodjob-blog-item__button" href="<?php the_permalink(); ?>">View Detail</a>
          </div>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    <?php else : ?>
      <p class="goodjob-blog-empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p>
    <?php endif; ?>
  </div>
</section>`;
}

function buildAiSiteWpProductsArchiveStyle() {
  return `.goodjob-products-page{background:#fff;padding:clamp(54px,6vw,92px) clamp(18px,4vw,54px)}
.goodjob-products-page__wrap{width:min(1440px,100%);margin:auto;display:grid;grid-template-columns:292px minmax(0,1fr);gap:clamp(34px,5vw,68px);align-items:start}
.goodjob-products-sidebar{background:#f0f0f0;padding:0 12px 12px;position:sticky;top:110px}
.goodjob-products-sidebar h1{margin:0 -12px 10px;padding:16px 16px;background:var(--blue,#244aa5);color:#fff;text-transform:uppercase;font-size:21px;line-height:1.15;letter-spacing:.01em}
.goodjob-products-sidebar nav{display:grid;background:#fff}
.goodjob-products-sidebar a{display:block;padding:16px 26px;border-bottom:1px solid #e7e7e7;color:#111827;text-decoration:none;font-size:18px;line-height:1.35}
.goodjob-products-sidebar a:hover,.goodjob-products-sidebar a.is-active{color:var(--blue,#244aa5);background:#f7f9ff}
.goodjob-products-main__head{margin-bottom:clamp(22px,3vw,34px)}
.goodjob-products-main__head span{display:inline-flex;margin-bottom:8px;color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;letter-spacing:.1em;font-size:12px}
.goodjob-products-main__head h2{margin:0 0 10px;color:#101828;font-size:clamp(30px,3.4vw,48px);line-height:1.08}
.goodjob-products-main__head p{margin:0;max-width:820px;color:#667085;font-size:16px;line-height:1.7}
.goodjob-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.goodjob-product-card{position:relative;background:#fff;border:1px solid #d3d3d3;min-width:0;text-align:center}
.goodjob-product-card__media{position:relative;display:block;aspect-ratio:1/1;background:#f7f8fa;overflow:hidden}
.goodjob-product-card__media img{width:100%;height:100%;object-fit:contain;display:block;transition:transform .35s ease}
.goodjob-product-card__media span{position:absolute;right:18px;top:22%;width:68px;height:68px;border-radius:50%;background:var(--blue,#244aa5);color:#fff;display:grid;place-items:center;font-size:38px;box-shadow:0 0 0 8px rgba(255,255,255,.88);opacity:0;transform:translateX(10px);transition:.25s ease}
.goodjob-product-card:hover .goodjob-product-card__media img{transform:scale(1.035)}
.goodjob-product-card:hover .goodjob-product-card__media span{opacity:1;transform:none}
.goodjob-product-card h3{min-height:82px;margin:0;padding:18px 18px 20px;display:grid;place-items:center;font-size:20px;line-height:1.12;font-weight:500}
.goodjob-product-card h3 a{color:#050b18;text-decoration:none}
.goodjob-products-empty{padding:28px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
@media(max-width:1100px){.goodjob-products-page__wrap{grid-template-columns:240px minmax(0,1fr)}.goodjob-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.goodjob-products-page{padding:36px 16px}.goodjob-products-page__wrap{grid-template-columns:1fr}.goodjob-products-sidebar{position:static}.goodjob-product-grid{grid-template-columns:1fr}.goodjob-product-card__media span{opacity:1;transform:none;width:54px;height:54px;font-size:30px}}`;
}

function buildAiSiteWpBlogArchiveStyle() {
  return `.goodjob-blog-page{background:#fff;color:#101828}
.goodjob-blog-hero{position:relative;min-height:255px;display:grid;place-items:start center;padding-top:8px;background:linear-gradient(rgba(0,0,0,.52),rgba(0,0,0,.52)),url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80") center 42%/cover no-repeat;color:#fff}
.goodjob-blog-hero h1{position:relative;margin:0;font-size:38px;line-height:1.1;color:#fff;font-weight:800}
.goodjob-blog-breadcrumb{background:#f0f0f0;min-height:72px;display:flex;align-items:center;gap:14px;padding:0 max(24px,calc((100vw - 1570px)/2 + 24px));font-size:19px}
.goodjob-blog-breadcrumb a{color:#111827;text-decoration:none}.goodjob-blog-breadcrumb span:last-child{color:var(--blue,#244aa5);text-transform:capitalize}
.goodjob-blog-list{width:min(1550px,calc(100vw - clamp(32px,8vw,180px)));margin:0 auto;padding:clamp(56px,7vw,78px) 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:62px;row-gap:54px}
.goodjob-blog-item{display:grid;grid-template-columns:minmax(180px,245px) minmax(0,1fr);gap:24px;padding-bottom:28px;border-bottom:1px solid #e7e7e7;align-items:start}
.goodjob-blog-item__media{display:block;border:1px solid #ddd;background:#f6f7f9;padding:6px;aspect-ratio:2/1;overflow:hidden}
.goodjob-blog-item__media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.goodjob-blog-item:hover .goodjob-blog-item__media img{transform:scale(1.04)}
.goodjob-blog-item__body{min-width:0}.goodjob-blog-item h2{margin:0 0 14px;font-size:24px;line-height:1.16;color:var(--blue,#244aa5)}
.goodjob-blog-item h2 a{color:inherit;text-decoration:none}.goodjob-blog-item time{display:block;margin-bottom:18px;color:#9aa0a6;font-size:18px}
.goodjob-blog-item time::before{content:"▣";font-size:14px;margin-right:6px;color:#a7adb4}.goodjob-blog-item p{margin:0;color:#050b18;font-size:18px;line-height:1.55}
.goodjob-blog-item__button{float:right;margin-top:18px;display:inline-flex;align-items:center;justify-content:center;min-width:140px;min-height:38px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-size:16px}
.goodjob-blog-empty{grid-column:1/-1;padding:28px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
@media(max-width:1180px){.goodjob-blog-list{grid-template-columns:1fr;width:min(100% - 48px,860px)}}
@media(max-width:640px){.goodjob-blog-hero{min-height:190px}.goodjob-blog-breadcrumb{min-height:60px;font-size:16px;padding:0 20px}.goodjob-blog-list{width:min(100% - 32px,680px);padding:40px 0}.goodjob-blog-item{grid-template-columns:1fr}.goodjob-blog-item__button{float:none;width:100%}}`;
}

function buildAiSiteWpProductDetailTemplate() {
  return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/product-detail /-->`);
}

function buildAiSiteWpNewsDetailTemplate() {
  return buildAiSiteWpTemplateShell(`<!-- wp:goodjob-ai-site/news-detail /-->`);
}

function buildAiSiteWpProductDetailRender() {
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'product_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/900x720/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$sku = (string) get_post_meta($post_id, 'goodjob_sku', true);
$material = (string) get_post_meta($post_id, 'goodjob_material', true);
$application = (string) get_post_meta($post_id, 'goodjob_application', true);
$lead_time = (string) get_post_meta($post_id, 'goodjob_lead_time', true);
$export_docs = (string) get_post_meta($post_id, 'goodjob_export_docs', true);
$specs = array(
    'SKU' => $sku ?: 'Confirm by drawing or sample',
    'Category' => $primary_term ? $primary_term->name : 'Industrial Product',
    'Material' => $material ?: 'Custom material available',
    'Application' => $application ?: 'Industrial fluid control and OEM supply',
    'Lead Time' => $lead_time ?: '15-35 days after confirmation',
    'Export Documents' => $export_docs ?: 'Invoice, packing list, certificate, inspection record',
);
$related_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-product-detail">
  <nav class="goodjob-product-detail__breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">/</span>
    <a href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Products</a>
    <span aria-hidden="true">/</span>
    <span><?php the_title(); ?></span>
  </nav>
  <section class="goodjob-product-detail__hero">
    <div class="goodjob-product-detail__media">
      <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
    </div>
    <div class="goodjob-product-detail__summary">
      <div class="goodjob-product-detail__terms">
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 34)); ?></p>
      <div class="goodjob-product-detail__actions">
        <a class="goodjob-product-detail__primary" href="<?php echo esc_url(home_url('/contact-us/')); ?>">Request Price & Drawings</a>
        <a class="goodjob-product-detail__ghost" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Back to Products</a>
      </div>
    </div>
  </section>
  <section class="goodjob-product-detail__body">
    <aside class="goodjob-product-detail__specs">
      <h2>Product Specifications</h2>
      <dl>
        <?php foreach ($specs as $label => $value) : ?>
          <div><dt><?php echo esc_html($label); ?></dt><dd><?php echo esc_html($value); ?></dd></div>
        <?php endforeach; ?>
      </dl>
      <div class="goodjob-product-detail__rfq">
        <strong>RFQ Checklist</strong>
        <ul>
          <li>Target model, drawing, or sample photo</li>
          <li>Quantity and destination market</li>
          <li>Material, pressure, size, and inspection needs</li>
        </ul>
      </div>
    </aside>
    <div class="goodjob-product-detail__content">
      <?php the_content(); ?>
    </div>
  </section>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-product-detail__related">
    <div class="goodjob-product-detail__related-head">
      <span>Related Products</span>
      <h2>More options in this category</h2>
    </div>
    <div class="goodjob-product-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post();
        $related_image = get_the_post_thumbnail_url(get_the_ID(), 'medium');
        if (!$related_image) {
            $related_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$related_image) {
            $related_image = 'https://placehold.co/420x320/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article>
          <a href="<?php the_permalink(); ?>"><img src="<?php echo esc_url($related_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async"></a>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>`;
}

function buildAiSiteWpProductDetailStyle() {
  return `.goodjob-product-detail{background:#fff;color:#101828}
.goodjob-product-detail__breadcrumb{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;padding:24px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:#667085;font-size:14px}
.goodjob-product-detail__breadcrumb a{color:var(--blue,#244aa5);text-decoration:none}
.goodjob-product-detail__hero{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;display:grid;grid-template-columns:minmax(360px,.9fr) minmax(0,1fr);gap:clamp(34px,5vw,76px);align-items:center;padding:clamp(18px,3vw,38px) 0 clamp(54px,7vw,92px)}
.goodjob-product-detail__media{background:#f4f7fb;border:1px solid #d9e1ec;aspect-ratio:1/1;display:grid;place-items:center;padding:clamp(18px,3vw,42px)}
.goodjob-product-detail__media img{width:100%;height:100%;object-fit:contain;display:block}
.goodjob-product-detail__terms{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}
.goodjob-product-detail__terms a{background:#eef4ff;color:var(--blue,#244aa5);border:1px solid #cdddf8;padding:7px 10px;font-size:12px;text-transform:uppercase;font-weight:900;text-decoration:none}
.goodjob-product-detail__summary h1{margin:0 0 18px;color:#050b18;font-size:clamp(38px,5vw,68px);line-height:1.02;letter-spacing:0}
.goodjob-product-detail__summary p{margin:0;color:#536273;font-size:clamp(16px,1.3vw,19px);line-height:1.75;max-width:720px}
.goodjob-product-detail__actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}
.goodjob-product-detail__primary,.goodjob-product-detail__ghost{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;text-decoration:none;font-weight:900}
.goodjob-product-detail__primary{background:var(--blue,#244aa5);color:#fff}.goodjob-product-detail__ghost{background:#fff;color:#101828;border:1px solid #cfd8e6}
.goodjob-product-detail__body{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:0 auto;display:grid;grid-template-columns:360px minmax(0,1fr);gap:clamp(30px,5vw,72px);align-items:start;padding:0 0 clamp(64px,8vw,108px)}
.goodjob-product-detail__specs{background:#f6f8fb;border-top:5px solid var(--blue,#244aa5);padding:clamp(22px,3vw,34px);position:sticky;top:112px}
.goodjob-product-detail__specs h2{margin:0 0 20px;font-size:24px;color:#101828}
.goodjob-product-detail__specs dl{margin:0;display:grid;gap:0}.goodjob-product-detail__specs div{border-bottom:1px solid #dce4ee;padding:13px 0}
.goodjob-product-detail__specs dt{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#667085;font-weight:900}.goodjob-product-detail__specs dd{margin:5px 0 0;color:#101828;line-height:1.45}
.goodjob-product-detail__rfq{margin-top:24px;background:#fff;border:1px solid #dde5ef;padding:18px}.goodjob-product-detail__rfq strong{display:block;margin-bottom:10px}.goodjob-product-detail__rfq ul{margin:0;padding-left:18px;color:#536273;line-height:1.65}
.goodjob-product-detail__content{min-width:0;color:#263241;font-size:17px;line-height:1.78}.goodjob-product-detail__content h2,.goodjob-product-detail__content h3{color:#101828;line-height:1.18}.goodjob-product-detail__content table{width:100%;border-collapse:collapse;margin:22px 0}.goodjob-product-detail__content th,.goodjob-product-detail__content td{border:1px solid #dde5ef;padding:12px;text-align:left}
.goodjob-product-detail__related{background:#f6f8fb;padding:clamp(52px,7vw,86px) clamp(18px,4vw,54px)}.goodjob-product-detail__related-head,.goodjob-product-detail__related-grid{width:min(1440px,100%);margin:auto}.goodjob-product-detail__related-head span{color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.1em}.goodjob-product-detail__related-head h2{margin:8px 0 28px;font-size:clamp(28px,3.5vw,44px)}
.goodjob-product-detail__related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.goodjob-product-detail__related-grid article{background:#fff;border:1px solid #dce4ee;padding:16px}.goodjob-product-detail__related-grid img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#f4f7fb}.goodjob-product-detail__related-grid h3{font-size:18px;line-height:1.25}.goodjob-product-detail__related-grid a{color:#101828;text-decoration:none}
@media(max-width:980px){.goodjob-product-detail__hero,.goodjob-product-detail__body{grid-template-columns:1fr}.goodjob-product-detail__specs{position:static}.goodjob-product-detail__related-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.goodjob-product-detail__hero,.goodjob-product-detail__body,.goodjob-product-detail__breadcrumb{width:min(100% - 32px,680px)}.goodjob-product-detail__actions a{width:100%}.goodjob-product-detail__related-grid{grid-template-columns:1fr}}`;
}

function buildAiSiteWpNewsDetailRender() {
  return `<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'news_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/1200x640/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$related_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-news-detail">
  <header class="goodjob-news-detail__hero">
    <div class="goodjob-news-detail__shade"></div>
    <div class="goodjob-news-detail__hero-inner">
      <nav class="goodjob-news-detail__breadcrumb" aria-label="Breadcrumb">
        <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
        <span aria-hidden="true">/</span>
        <a href="<?php echo esc_url(get_post_type_archive_link('news')); ?>">Blog</a>
      </nav>
      <div class="goodjob-news-detail__meta">
        <?php if ($primary_term) : ?><span><?php echo esc_html($primary_term->name); ?></span><?php endif; ?>
        <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 28)); ?></p>
    </div>
  </header>
  <div class="goodjob-news-detail__layout">
    <main class="goodjob-news-detail__main">
      <figure class="goodjob-news-detail__image">
        <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
      </figure>
      <div class="goodjob-news-detail__content">
        <?php the_content(); ?>
      </div>
    </main>
    <aside class="goodjob-news-detail__aside">
      <div class="goodjob-news-detail__panel">
        <strong>Need help with product selection?</strong>
        <p>Send your operating conditions, target market, and expected quantity. We will prepare a focused RFQ path.</p>
        <a href="<?php echo esc_url(home_url('/contact-us/')); ?>">Send Inquiry</a>
      </div>
      <?php if (!empty($terms)) : ?>
      <div class="goodjob-news-detail__panel">
        <strong>Topics</strong>
        <div class="goodjob-news-detail__tags">
          <?php foreach ($terms as $term) :
            $term_link = get_term_link($term);
            if (is_wp_error($term_link)) {
                continue;
            }
          ?>
            <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>
    </aside>
  </div>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-news-detail__related">
    <div class="goodjob-news-detail__related-head">
      <span>More Blogs</span>
      <h2>Related reading</h2>
    </div>
    <div class="goodjob-news-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post(); ?>
        <article>
          <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
          <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 18)); ?></p>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>`;
}

function buildAiSiteWpNewsDetailStyle() {
  return `.goodjob-news-detail{background:#fff;color:#101828}
.goodjob-news-detail__hero{position:relative;min-height:430px;background:linear-gradient(rgba(6,16,32,.66),rgba(6,16,32,.66)),url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80") center/cover no-repeat;color:#fff;display:grid;align-items:end}
.goodjob-news-detail__hero-inner{position:relative;width:min(1120px,calc(100vw - clamp(32px,8vw,160px)));margin:0 auto;padding:54px 0}
.goodjob-news-detail__breadcrumb{display:flex;gap:10px;align-items:center;margin-bottom:22px;color:rgba(255,255,255,.76)}.goodjob-news-detail__breadcrumb a{color:#fff;text-decoration:none}
.goodjob-news-detail__meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}.goodjob-news-detail__meta span,.goodjob-news-detail__meta time{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);padding:7px 10px;font-size:12px;text-transform:uppercase;font-weight:900;letter-spacing:.08em}
.goodjob-news-detail__hero h1{max-width:920px;margin:0;color:#fff;font-size:clamp(38px,5vw,70px);line-height:1.04}.goodjob-news-detail__hero p{max-width:760px;margin:18px 0 0;color:rgba(255,255,255,.8);font-size:18px;line-height:1.65}
.goodjob-news-detail__layout{width:min(1320px,calc(100vw - clamp(32px,7vw,130px)));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:clamp(34px,5vw,72px);padding:clamp(54px,7vw,90px) 0}
.goodjob-news-detail__image{margin:0 0 34px;background:#f4f7fb;border:1px solid #dde5ef}.goodjob-news-detail__image img{width:100%;aspect-ratio:16/8;object-fit:cover;display:block}
.goodjob-news-detail__content{font-size:18px;line-height:1.82;color:#263241}.goodjob-news-detail__content h2,.goodjob-news-detail__content h3{color:#101828;line-height:1.18;margin-top:1.7em}.goodjob-news-detail__content ul{padding-left:1.3em}
.goodjob-news-detail__aside{display:grid;gap:20px;align-content:start;position:sticky;top:112px}.goodjob-news-detail__panel{background:#f6f8fb;border:1px solid #dde5ef;border-top:4px solid var(--blue,#244aa5);padding:22px}.goodjob-news-detail__panel strong{display:block;color:#101828;font-size:20px;line-height:1.2}.goodjob-news-detail__panel p{color:#536273;line-height:1.65}.goodjob-news-detail__panel>a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900;padding:0 16px}
.goodjob-news-detail__tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.goodjob-news-detail__tags a{background:#fff;color:var(--blue,#244aa5);border:1px solid #cdddf8;text-decoration:none;padding:7px 10px;font-weight:800}
.goodjob-news-detail__related{background:#f6f8fb;padding:clamp(52px,7vw,86px) clamp(18px,4vw,54px)}.goodjob-news-detail__related-head,.goodjob-news-detail__related-grid{width:min(1320px,100%);margin:auto}.goodjob-news-detail__related-head span{color:var(--blue,#244aa5);font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.1em}.goodjob-news-detail__related-head h2{margin:8px 0 28px;font-size:clamp(28px,3.5vw,44px)}
.goodjob-news-detail__related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.goodjob-news-detail__related-grid article{background:#fff;border:1px solid #dce4ee;padding:24px}.goodjob-news-detail__related-grid time{color:#98a2b3}.goodjob-news-detail__related-grid h3{font-size:20px;line-height:1.2}.goodjob-news-detail__related-grid a{color:var(--blue,#244aa5);text-decoration:none}.goodjob-news-detail__related-grid p{color:#536273;line-height:1.6}
@media(max-width:980px){.goodjob-news-detail__layout{grid-template-columns:1fr}.goodjob-news-detail__aside{position:static}.goodjob-news-detail__related-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.goodjob-news-detail__hero{min-height:360px}.goodjob-news-detail__hero-inner,.goodjob-news-detail__layout{width:min(100% - 32px,680px)}.goodjob-news-detail__related-grid{grid-template-columns:1fr}}`;
}

function buildAiSiteWpSingleTemplate(config: { cpt: string; tone: "product" | "case" | "news" | "service" | "generic"; cta: string }) {
  const toneClass = `goodjob-single--${config.tone}`;
  return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-single ${toneClass}","layout":{"type":"constrained","contentSize":"1180px"}} -->
<article class="wp-block-group goodjob-single ${toneClass}">
  <!-- wp:post-terms {"term":"${config.cpt === "product" ? "product_cat" : config.cpt === "case" ? "case_cat" : config.cpt === "news" ? "news_cat" : config.cpt === "service" ? "service_cat" : "category"}","className":"goodjob-single__terms"} /-->
  <!-- wp:post-title {"level":1,"className":"goodjob-single__title"} /-->
  <!-- wp:post-featured-image {"aspectRatio":"16/9","className":"goodjob-single__media"} /-->
  <!-- wp:post-content {"layout":{"type":"constrained","contentSize":"860px"},"className":"goodjob-single__content"} /-->
  <!-- wp:group {"className":"goodjob-single__cta","layout":{"type":"flex","justifyContent":"space-between","flexWrap":"wrap"}} -->
  <div class="wp-block-group goodjob-single__cta">
    <!-- wp:paragraph --><p>${htmlEscape(config.cta)}</p><!-- /wp:paragraph -->
    <!-- wp:buttons -->
    <div class="wp-block-buttons"><!-- wp:button {"className":"is-style-fill"} --><div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button" href="/contact-us/">Send Inquiry</a></div><!-- /wp:button --></div>
    <!-- /wp:buttons -->
  </div>
  <!-- /wp:group -->
</article>
<!-- /wp:group -->`);
}

function buildAiSiteWpSearchTemplate() {
  return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-archive goodjob-archive--search","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group goodjob-archive goodjob-archive--search">
  <!-- wp:query-title {"type":"search","level":1} /-->
  <!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search","className":"goodjob-search-form"} /-->
  <!-- wp:query {"query":{"perPage":10,"pages":0,"offset":0,"postType":"any","order":"desc","orderBy":"date","inherit":true}} -->
  <div class="wp-block-query">
    <!-- wp:post-template className="goodjob-archive__grid" -->
      <!-- wp:group {"className":"goodjob-card","layout":{"type":"constrained"}} -->
      <article class="wp-block-group goodjob-card">
        <!-- wp:post-title {"isLink":true,"level":2,"className":"goodjob-card__title"} /-->
        <!-- wp:post-excerpt {"moreText":"Read More"} /-->
      </article>
      <!-- /wp:group -->
    <!-- /wp:post-template -->
    <!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"center"}} -->
      <!-- wp:query-pagination-previous /-->
      <!-- wp:query-pagination-numbers /-->
      <!-- wp:query-pagination-next /-->
    <!-- /wp:query-pagination -->
  </div>
  <!-- /wp:query -->
</section>
<!-- /wp:group -->`);
}

function buildAiSiteWp404Template() {
  return buildAiSiteWpTemplateShell(`<!-- wp:group {"className":"goodjob-not-found","layout":{"type":"constrained","contentSize":"760px"}} -->
<section class="wp-block-group goodjob-not-found">
  <!-- wp:heading {"level":1} --><h1>Page Not Found</h1><!-- /wp:heading -->
  <!-- wp:paragraph --><p>The page you are looking for may have moved. Search the site or return to the homepage.</p><!-- /wp:paragraph -->
  <!-- wp:search {"label":"Search","showLabel":false,"buttonText":"Search"} /-->
  <!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
  <div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/">Back to Home</a></div><!-- /wp:button --></div>
  <!-- /wp:buttons -->
</section>
<!-- /wp:group -->`);
}

function buildAiSiteWpRouteCss() {
  return `

/* Multi-route WordPress templates */
.goodjob-archive,.goodjob-single,.goodjob-not-found{padding:clamp(64px,8vw,116px) clamp(20px,4vw,56px)}
.goodjob-archive__head{margin-bottom:clamp(28px,4vw,56px);text-align:center}
.goodjob-archive__head h1,.goodjob-single__title,.goodjob-not-found h1{margin:0 0 16px;color:var(--ink,#16202e);font-size:clamp(36px,5vw,68px);line-height:1.04}
.goodjob-archive__head p,.goodjob-single__content,.goodjob-not-found p{color:var(--body,#3c4858);font-size:clamp(16px,1.2vw,18px);line-height:1.75}
.goodjob-archive__grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,2.4vw,30px)}
.goodjob-card{background:#fff;border:1px solid var(--line,#e2e7ee);box-shadow:0 18px 48px rgba(16,32,60,.08);overflow:hidden}
.goodjob-card__media{margin:0;background:#eef2f7}
.goodjob-card__terms{margin:18px 20px 6px;color:var(--red,#c8161c);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.goodjob-card__title{margin:0 20px 10px;font-size:clamp(20px,1.8vw,28px);line-height:1.16}
.goodjob-card__title a{color:var(--ink,#16202e);text-decoration:none}
.goodjob-card__excerpt{margin:0 20px 22px;color:var(--body,#3c4858);line-height:1.68}
.goodjob-archive--product{background:#f7f9fc}.goodjob-archive--case{background:#fff}.goodjob-archive--news{background:#f5f7fb}.goodjob-archive--service{background:#fff}
.goodjob-archive--case .goodjob-card{border-radius:0}.goodjob-archive--news .goodjob-card{box-shadow:none;border-left:4px solid var(--blue,#143a7b)}.goodjob-archive--service .goodjob-card{display:grid;grid-template-columns:190px minmax(0,1fr)}
.goodjob-single{background:#fff}
.goodjob-single__terms{color:var(--red,#c8161c);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.goodjob-single__media{margin:clamp(22px,4vw,42px) 0;background:#eef2f7}
.goodjob-single__content{max-width:860px;margin:0 auto}
.goodjob-single__cta{margin-top:clamp(30px,5vw,56px);padding:clamp(20px,3vw,34px);background:#f7f9fc;border:1px solid var(--line,#e2e7ee)}
.goodjob-pagination{margin-top:clamp(28px,4vw,48px)}
.goodjob-search-form{margin:0 auto 34px;max-width:720px}
.goodjob-not-found{text-align:center;min-height:54vh;display:grid;place-content:center}
@media(max-width:920px){.goodjob-archive__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.goodjob-archive--service .goodjob-card{display:block}}
@media(max-width:640px){.goodjob-archive__grid{grid-template-columns:1fr}.goodjob-archive,.goodjob-single,.goodjob-not-found{padding:48px 20px}}
`;
}

function aiSiteWpRebuildSummary(checks: AiSiteWpRebuildCheck[]) {
  return checks.reduce((summary, check) => {
    summary[check.status] += 1;
    return summary;
  }, { pass: 0, warning: 0, error: 0 });
}

async function inspectAiSiteWpRebuild(project: AiSiteBuilderProject) {
  await ensureAiSiteSandbox(project);
  const order = await readAiSiteOrder(project);
  const customPages = await readAiSiteCustomPages(project);
  const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
  const sectionMap = new Map(wpMetadata.sections.map((section) => [section.section_key, section]));
  const checks: AiSiteWpRebuildCheck[] = [];

  for (const sectionKey of order) {
    const section = sectionMap.get(sectionKey);
    const label = aiSiteSectionLabel(sectionKey, customPages);
    const file = aiSectionFile(project.id, sectionKey);
    if (!(await fileExists(file))) {
      checks.push({
        key: sectionKey,
        label,
        status: aiSiteLockedSections.has(sectionKey) ? "warning" : "error",
        message: aiSiteLockedSections.has(sectionKey) ? "Locked component will use the default fragment." : "HTML source file is missing.",
        target: section?.wp_target
      });
      continue;
    }

    const html = await readFile(file, "utf8").catch(() => "");
    if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
      checks.push({ key: sectionKey, label, status: "error", message: "Fragment appears to contain CRM shell content.", target: section?.wp_target });
      continue;
    }
    if (!/<(section|header|footer|main|article)\b/i.test(html)) {
      checks.push({ key: sectionKey, label, status: "warning", message: "Fragment has no semantic wrapper; it can export but needs WP review.", target: section?.wp_target });
      continue;
    }
    checks.push({ key: sectionKey, label, status: "pass", message: "HTML source and WP metadata are ready.", target: section?.wp_target });
  }

  const root = aiBuildRoot();
  checks.push({
    key: "ai_build_root",
    label: "AI build storage",
    status: await fileExists(root) ? "pass" : "warning",
    message: `Project storage is resolved to ${root}.`,
    target: root
  });

  const routeBlueprint = buildAiSiteWpRouteBlueprint(project);
  const staticPageCount = Object.keys(routeBlueprint.static_pages).length;
  const cptRoutes = Object.entries(routeBlueprint.cpt_routes);
  checks.push({
    key: "wp_routes",
    label: "WordPress route blueprint",
    status: staticPageCount >= 4 && cptRoutes.length >= 4 ? "pass" : "warning",
    message: `Prepared ${staticPageCount} static pages and ${cptRoutes.length} CPT route groups for multi-route assembly.`,
    target: "theme/_data/routes.json"
  });

  const collections = buildAiSiteWpCollections(project);
  for (const [postType, collection] of Object.entries(collections)) {
    const items = Array.isArray(collection.items) ? collection.items : [];
    const routeConfig = routeBlueprint.cpt_routes[postType as keyof typeof routeBlueprint.cpt_routes];
    const expected = routeConfig?.seed_count || (postType === "service" ? 4 : 1);
    const withContent = items.filter((item) => typeof item.content === "string" && item.content.trim().length > 40).length;
    checks.push({
      key: `wp_collection_${postType}`,
      label: `${collection.label} seed data`,
      status: items.length >= expected && withContent === items.length ? "pass" : items.length ? "warning" : "error",
      message: `Prepared ${items.length} ${postType} seed records; ${withContent} include editable detail content.`,
      target: `theme/_data/collections.json:${postType}`
    });
  }

  const requiredTemplates = [
    "front-page.html", "index.html", "archive-product.html", "taxonomy-product_cat.html", "single-product.html",
    "archive-case.html", "taxonomy-case_cat.html", "single-case.html", "archive-news.html", "taxonomy-news_cat.html",
    "single-news.html", "archive-service.html", "taxonomy-service_cat.html", "single-service.html", "archive.html",
    "single.html", "search.html", "404.html"
  ];
  checks.push({
    key: "wp_templates",
    label: "WordPress template set",
    status: "pass",
    message: `Export will create ${requiredTemplates.length} block templates covering home, archives, taxonomies, singles, search, and 404.`,
    target: "theme/templates"
  });

  return { project, order, customPages, wpMetadata, checks, summary: aiSiteWpRebuildSummary(checks) };
}

async function exportAiSiteWpRebuildPackage(project: AiSiteBuilderProject) {
  const state = await inspectAiSiteWpRebuild(project);
  const exportDir = aiSiteWpRebuildExportDir(project.id);
  const themeSlug = cleanAiSiteWpThemeSlug(project.siteName || project.taskName || project.id);
  const themeDir = path.join(exportDir, "theme");
  const sectionsDir = path.join(exportDir, "sections");
  const patternsDir = path.join(themeDir, "patterns");
  const partsDir = path.join(themeDir, "parts");
  const templatesDir = path.join(themeDir, "templates");
  const blocksDir = path.join(themeDir, "blocks");
  const acfJsonDir = path.join(themeDir, "acf-json");
  const dataDir = path.join(themeDir, "_data");
  const incDir = path.join(themeDir, "inc");
  const assetsJsDir = path.join(themeDir, "assets", "js");
  const exportedAt = new Date().toISOString();
  const files: string[] = [];

  await rm(exportDir, { recursive: true, force: true });
  await mkdir(sectionsDir, { recursive: true });
  await mkdir(patternsDir, { recursive: true });
  await mkdir(partsDir, { recursive: true });
  await mkdir(templatesDir, { recursive: true });
  await mkdir(blocksDir, { recursive: true });
  await mkdir(acfJsonDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(incDir, { recursive: true });
  await mkdir(assetsJsDir, { recursive: true });

  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const title = cleanAiSiteWpHeaderValue(schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName, "GoodJob AI Site");
  const description = cleanAiSiteWpHeaderValue(schema.company_profile.description || schema.company_profile.tagline, "Block theme starter exported from GoodJob AI Website Factory.");
  const pageBlockLines: string[] = [];
  const pageBlocksByKey = new Map<string, string>();

  for (const section of state.wpMetadata.sections) {
    const raw = await readFile(aiSectionFile(project.id, section.section_key), "utf8").catch(() => defaultAiSectionHtml(section.section_key, project, false, state.customPages));
    const fragment = sanitizeAiSiteWpExportFragment(raw);
    const sourceName = `${section.section_key}.html`;
    await writeFile(path.join(sectionsDir, sourceName), fragment, "utf8");
    files.push(`sections/${sourceName}`);

    if (section.section_key === "header" || section.section_key === "footer") {
      const partName = `${section.section_key}.html`;
      const partFragment = section.section_key === "header" ? `${aiSiteIconSprite()}\n${fragment}` : fragment;
      await writeFile(path.join(partsDir, partName), partFragment, "utf8");
      files.push(`theme/parts/${partName}`);
      continue;
    }

    const patternSlug = cleanAiSiteWpThemeSlug(section.section_key, "section");
    const patternFile = `${patternSlug}.php`;
    const pattern = `<?php
/**
 * Title: ${section.label}
 * Slug: ${themeSlug}/${patternSlug}
 * Categories: goodjob-ai-site
 */
?>
${fragment}
`;
    await writeFile(path.join(patternsDir, patternFile), pattern, "utf8");
    files.push(`theme/patterns/${patternFile}`);
    const blockSlug = aiSiteWpBlockSlug(section.section_key);
    const blockDir = path.join(blocksDir, blockSlug);
    await mkdir(blockDir, { recursive: true });
    await writeFile(path.join(blockDir, "block.json"), JSON.stringify(buildAiSiteWpBlockJson(section), null, 2), "utf8");
    await writeFile(path.join(blockDir, "render.php"), buildAiSiteWpBlockRender(section, fragment), "utf8");
    await writeFile(path.join(blockDir, "style.css"), buildAiSiteWpBlockStyle(section), "utf8");
    await writeFile(path.join(acfJsonDir, `group_block_${blockSlug}.json`), JSON.stringify(buildAiSiteWpAcfFieldGroup(section, fragment), null, 2), "utf8");
    files.push(`theme/blocks/${blockSlug}/block.json`, `theme/blocks/${blockSlug}/render.php`, `theme/blocks/${blockSlug}/style.css`, `theme/acf-json/group_block_${blockSlug}.json`);
    const pageBlock = buildAiSiteWpPageBlock(section, fragment);
    pageBlockLines.push(pageBlock);
    pageBlocksByKey.set(section.section_key, pageBlock);
  }

  const styleCss = `/*
Theme Name: ${title}
Theme URI: https://goodjob.local/ai-site
Author: GoodJob AI Website Factory
Description: ${description}
Version: 0.1.0
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.0
Text Domain: ${themeSlug}
*/

${aiSiteFrameworkCss(project)}
${buildAiSiteWpRouteCss()}
`;
  const themeJson = {
    version: 3,
    settings: {
      appearanceTools: true,
      layout: { contentSize: "1180px", wideSize: "1440px" }
    },
    styles: {
      color: { background: "#ffffff", text: "#101828" },
      typography: { fontFamily: "Inter, Arial, sans-serif" }
    },
    templateParts: [
      { name: "header", title: "Header", area: "header" },
      { name: "footer", title: "Footer", area: "footer" }
    ]
  };
  const siteOptions = buildAiSiteWpSiteOptions(project);
  const collections = buildAiSiteWpCollections(project);
  const routeBlueprint = buildAiSiteWpRouteBlueprint(project);
  const pageContent = pageBlockLines.join("\n\n");
  const pageContentFor = (keys: string[]) => keys.map((key) => pageBlocksByKey.get(key)).filter(Boolean).join("\n\n");
  const frontPageTemplate = `<!-- wp:template-part {"slug":"header"} /-->
<!-- wp:group {"tagName":"main","layout":{"type":"default"}} -->
<main class="wp-block-group">
<!-- wp:post-content {"layout":{"type":"default"}} /-->
</main>
<!-- /wp:group -->
<!-- wp:template-part {"slug":"footer"} /-->`;
  const pages = {
    home: {
      title: "Home",
      slug: "home",
      template: "front-page",
      status: "publish",
      post_content: pageContent
    },
    applications: {
      title: "Applications",
      slug: "applications",
      template: "page",
      status: "publish",
      post_content: pageContentFor(["applications", "products", "contact_us"])
    },
    about_us: {
      title: "About Us",
      slug: "about-us",
      template: "page",
      status: "publish",
      post_content: pageContentFor(["about_us", "applications", "contact_us"])
    },
    contact_us: {
      title: "Contact Us",
      slug: "contact-us",
      template: "page",
      status: "publish",
      post_content: pageContentFor(["contact_us"])
    },
    thanks: {
      title: "Thank You",
      slug: "thanks",
      template: "page",
      status: "publish",
      post_content: `<!-- wp:group {"className":"goodjob-not-found","layout":{"type":"constrained","contentSize":"760px"}} -->
<section class="wp-block-group goodjob-not-found">
<!-- wp:heading {"level":1} --><h1>Thank You</h1><!-- /wp:heading -->
<!-- wp:paragraph --><p>Your inquiry has been received. Our team will review your project details and respond with the next step as soon as possible.</p><!-- /wp:paragraph -->
<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/">Back to Home</a></div><!-- /wp:button --></div><!-- /wp:buttons -->
</section>
<!-- /wp:group -->`
    }
  };
  const readme = `# ${title}

This is a WordPress ACF block theme package exported by GoodJob AI Website Factory.

- Review \`conversion-report.json\` before installation.
- Source fragments are stored in \`sections/\`.
- Editable ACF blocks are stored in \`theme/blocks/\`.
- ACF Local JSON field groups are stored in \`theme/acf-json/\`.
- Seed data and route blueprints are stored in \`theme/_data/\`.
- Activating the theme registers CPTs, ACF blocks, admin tools, static pages, route templates, and seed content once.
- Multi-route templates include products, cases, services, blog/news, taxonomy archives, single detail pages, search, and 404.
`;
  const cptPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_collection_types() {
    return array(
        'product' => array('label' => 'Products', 'singular' => 'Product', 'taxonomy' => 'product_cat', 'archive_slug' => 'products', 'taxonomy_slug' => 'product-category', 'icon' => 'dashicons-products'),
        'service' => array('label' => 'Services', 'singular' => 'Service', 'taxonomy' => 'service_cat', 'archive_slug' => 'services', 'taxonomy_slug' => 'service-category', 'icon' => 'dashicons-hammer'),
        'case' => array('label' => 'Cases', 'singular' => 'Case', 'taxonomy' => 'case_cat', 'archive_slug' => 'cases', 'taxonomy_slug' => 'case-category', 'icon' => 'dashicons-portfolio'),
        'news' => array('label' => 'News', 'singular' => 'News', 'taxonomy' => 'news_cat', 'archive_slug' => 'blog', 'taxonomy_slug' => 'news-category', 'icon' => 'dashicons-media-document'),
    );
}

function goodjob_ai_site_register_cpts() {
    foreach (goodjob_ai_site_collection_types() as $post_type => $config) {
        register_post_type($post_type, array(
            'labels' => array(
                'name' => $config['label'],
                'singular_name' => $config['singular'],
                'add_new_item' => 'Add New ' . $config['singular'],
                'edit_item' => 'Edit ' . $config['singular'],
            ),
            'public' => true,
            'show_in_rest' => true,
            'has_archive' => true,
            'menu_icon' => $config['icon'],
            'supports' => array('title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions'),
            'rewrite' => array('slug' => $config['archive_slug']),
        ));
        register_taxonomy($config['taxonomy'], array($post_type), array(
            'labels' => array('name' => $config['label'] . ' Categories'),
            'public' => true,
            'hierarchical' => true,
            'show_in_rest' => true,
            'rewrite' => array('slug' => $config['taxonomy_slug']),
        ));
    }
}
add_action('init', 'goodjob_ai_site_register_cpts');
`;
  const acfPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_acf_json_load_paths($paths) {
    $paths[] = get_stylesheet_directory() . '/acf-json';
    return $paths;
}
add_filter('acf/settings/load_json', 'goodjob_ai_site_acf_json_load_paths');

function goodjob_ai_site_register_acf_field_groups() {
    if (!function_exists('acf_add_local_field_group')) {
        return;
    }
    foreach (glob(get_stylesheet_directory() . '/acf-json/group_*.json') as $file) {
        $group = json_decode(file_get_contents($file), true);
        if (is_array($group) && !empty($group['key'])) {
            acf_add_local_field_group($group);
        }
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_field_groups', 5);

function goodjob_ai_site_block_categories($categories) {
    foreach ($categories as $category) {
        if (isset($category['slug']) && $category['slug'] === 'goodjob-ai-site') {
            return $categories;
        }
    }
    $categories[] = array(
        'slug' => 'goodjob-ai-site',
        'title' => 'GoodJob AI Site',
        'icon' => null,
    );
    return $categories;
}
add_filter('block_categories_all', 'goodjob_ai_site_block_categories', 10, 1);

function goodjob_ai_site_register_acf_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $dir = dirname($file);
        $metadata = json_decode(file_get_contents($file), true);
        if (!is_array($metadata) || empty($metadata['name'])) {
            continue;
        }
        $full_name = (string) $metadata['name'];
        if (strpos($full_name, 'acf/') !== 0) {
            continue;
        }
        $acf_name = preg_replace('#^acf/#', '', $full_name);
        if (!$acf_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        if (function_exists('acf_register_block_type')) {
            acf_register_block_type(array(
                'name' => $acf_name,
                'title' => $metadata['title'] ?? ucwords(str_replace('-', ' ', $acf_name)),
                'description' => $metadata['description'] ?? '',
                'category' => $metadata['category'] ?? 'goodjob-ai-site',
                'icon' => $metadata['icon'] ?? 'layout',
                'keywords' => $metadata['keywords'] ?? array('goodjob'),
                'mode' => $metadata['acf']['mode'] ?? 'preview',
                'render_template' => $dir . '/' . ($metadata['acf']['renderTemplate'] ?? 'render.php'),
                'supports' => $metadata['supports'] ?? array(),
            ));
            continue;
        }
        register_block_type($dir);
    }
}

function goodjob_ai_site_register_native_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $metadata = json_decode(file_get_contents($file), true);
        $full_name = is_array($metadata) && !empty($metadata['name']) ? (string) $metadata['name'] : '';
        if (!$full_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        register_block_type(dirname($file));
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_blocks', 20);
add_action('init', 'goodjob_ai_site_register_native_blocks', 30);

function goodjob_ai_site_enqueue_block_styles() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/style.css') as $file) {
        $slug = basename(dirname($file));
        wp_enqueue_style(
            'goodjob-ai-site-block-' . $slug,
            get_stylesheet_directory_uri() . '/blocks/' . $slug . '/style.css',
            array('goodjob-ai-site-style'),
            filemtime($file)
        );
    }
}
add_action('enqueue_block_assets', 'goodjob_ai_site_enqueue_block_styles');
`;
  const installerPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_read_json($relative) {
    $file = get_stylesheet_directory() . '/' . ltrim($relative, '/');
    if (!file_exists($file)) {
        return array();
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : array();
}

function goodjob_ai_site_data_signature() {
    $files = array('_data/pages.json', '_data/collections.json', '_data/site-options.json', '_data/routes.json');
    $hashes = array();
    foreach ($files as $relative) {
        $file = get_stylesheet_directory() . '/' . $relative;
        $hashes[] = file_exists($file) ? md5_file($file) : '';
    }
    return md5(implode('|', $hashes));
}

function goodjob_ai_site_is_legacy_generated_page_content($content) {
    $content = (string) $content;
    if ($content === '') {
        return false;
    }
    if (strpos($content, 'wp:template-part') !== false && strpos($content, 'wp:acf/') !== false) {
        return true;
    }
    if (strpos($content, 'wp:acf/') !== false && preg_match('/<!--\\s+wp:acf\\/[a-z0-9-]+\\s+[^>]*-->\\s*<(section|header|footer)\\b/i', $content)) {
        return true;
    }
    return false;
}

function goodjob_ai_site_seed_pages($force = false) {
    $pages = goodjob_ai_site_read_json('_data/pages.json');
    foreach ($pages as $page) {
        $slug = sanitize_title($page['slug'] ?? $page['title'] ?? 'home');
        $existing = get_page_by_path($slug);
        $existing_content = $existing ? trim((string) $existing->post_content) : '';
        $is_legacy_generated_shell = goodjob_ai_site_is_legacy_generated_page_content($existing_content);
        if ($existing && !$force && $existing_content !== '' && !$is_legacy_generated_shell) {
            continue;
        }
        $postarr = array(
            'post_title' => sanitize_text_field($page['title'] ?? 'Home'),
            'post_name' => $slug,
            'post_status' => sanitize_key($page['status'] ?? 'publish'),
            'post_type' => 'page',
            'post_content' => $page['post_content'] ?? '',
        );
        $page_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
        if (!is_wp_error($page_id) && $slug === 'home') {
            update_option('show_on_front', 'page');
            update_option('page_on_front', (int) $page_id);
        }
    }
}

function goodjob_ai_site_seed_collections($force = false) {
    $collections = goodjob_ai_site_read_json('_data/collections.json');
    foreach ($collections as $post_type => $collection) {
        if (!post_type_exists($post_type)) {
            continue;
        }
        $items = isset($collection['items']) && is_array($collection['items']) ? $collection['items'] : array();
        $taxonomy = '';
        $types = goodjob_ai_site_collection_types();
        if (isset($types[$post_type]['taxonomy'])) {
            $taxonomy = $types[$post_type]['taxonomy'];
        }
        foreach ($items as $item) {
            $title = sanitize_text_field($item['title'] ?? '');
            if (!$title) {
                continue;
            }
            $existing = get_page_by_title($title, OBJECT, $post_type);
            if ($existing && !$force) {
                continue;
            }
            $postarr = array(
                'post_title' => $title,
                'post_type' => $post_type,
                'post_status' => 'publish',
                'post_excerpt' => sanitize_textarea_field($item['desc'] ?? ''),
                'post_content' => wp_kses_post($item['content'] ?? $item['desc'] ?? ''),
                'post_date' => sanitize_text_field($item['date'] ?? current_time('mysql')),
            );
            $post_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
            if (is_wp_error($post_id)) {
                continue;
            }
            foreach ($item as $meta_key => $meta_value) {
                if (in_array($meta_key, array('title', 'desc', 'content', 'category', 'date'), true)) {
                    continue;
                }
                $clean_key = sanitize_key('goodjob_' . $meta_key);
                if (is_array($meta_value)) {
                    update_post_meta($post_id, $clean_key, wp_json_encode($meta_value, JSON_UNESCAPED_UNICODE));
                } else {
                    update_post_meta($post_id, $clean_key, sanitize_text_field((string) $meta_value));
                }
            }
            if ($taxonomy && !empty($item['category'])) {
                $term = term_exists($item['category'], $taxonomy);
                if (!$term) {
                    $term = wp_insert_term($item['category'], $taxonomy);
                }
                if (!is_wp_error($term)) {
                    wp_set_object_terms($post_id, array((int) $term['term_id']), $taxonomy);
                }
            }
        }
    }
}

function goodjob_ai_site_write_htaccess() {
    $base = parse_url(home_url('/'), PHP_URL_PATH);
    $base = $base ? trailingslashit($base) : '/';
    $index = $base . 'index.php';
    $rules = "# BEGIN WordPress\n";
    $rules .= "<IfModule mod_rewrite.c>\n";
    $rules .= "RewriteEngine On\n";
    $rules .= "RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n";
    $rules .= "RewriteBase " . $base . "\n";
    $rules .= "RewriteRule ^index\\.php$ - [L]\n";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-f\n";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-d\n";
    $rules .= "RewriteRule . " . $index . " [L]\n";
    $rules .= "</IfModule>\n";
    $rules .= "# END WordPress\n";
    $file = ABSPATH . '.htaccess';
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rules);
    }
}

function goodjob_ai_site_write_nginx_rewrite() {
    $file = ABSPATH . 'nginx.htaccess';
    $rule = "try_files \\$uri \\$uri/ /index.php?\\$args;\n";
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rule);
    }
}

function goodjob_ai_site_configure_routes() {
    global $wp_rewrite;
    if (get_option('permalink_structure') !== '/%postname%/') {
        update_option('permalink_structure', '/%postname%/');
    }
    if ($wp_rewrite && method_exists($wp_rewrite, 'set_permalink_structure')) {
        $wp_rewrite->set_permalink_structure('/%postname%/');
    }
    goodjob_ai_site_write_htaccess();
    goodjob_ai_site_write_nginx_rewrite();
}

function goodjob_ai_site_seed_all($force = false) {
    goodjob_ai_site_register_cpts();
    goodjob_ai_site_configure_routes();
    goodjob_ai_site_seed_pages($force);
    goodjob_ai_site_seed_collections($force);
    update_option('goodjob_ai_site_options', goodjob_ai_site_read_json('_data/site-options.json'));
    update_option('goodjob_ai_site_seeded_at', current_time('mysql'));
    update_option('goodjob_ai_site_data_signature', goodjob_ai_site_data_signature());
    flush_rewrite_rules();
}
add_action('after_switch_theme', function () {
    if (!get_option('goodjob_ai_site_seeded_at') || get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
add_action('admin_init', function () {
    if (current_user_can('manage_options') && get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
`;
  const adminPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_admin_menu() {
    add_menu_page(
        'GoodJob AI Site',
        'GoodJob AI Site',
        'manage_options',
        'goodjob-ai-site',
        'goodjob_ai_site_admin_page',
        'dashicons-admin-site-alt3',
        58
    );
}
add_action('admin_menu', 'goodjob_ai_site_admin_menu');

function goodjob_ai_site_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $options = goodjob_ai_site_read_json('_data/site-options.json');
    $collections = goodjob_ai_site_read_json('_data/collections.json');
    $routes = goodjob_ai_site_read_json('_data/routes.json');
    echo '<div class="wrap"><h1>GoodJob AI Site</h1>';
    echo '<p>This page is generated by GoodJob. It shows the imported site options, seed collections, and install status.</p>';
    echo '<p><strong>Last seeded:</strong> ' . esc_html(get_option('goodjob_ai_site_seeded_at', 'Not seeded yet')) . '</p>';
    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
    wp_nonce_field('goodjob_ai_site_reseed');
    echo '<input type="hidden" name="action" value="goodjob_ai_site_reseed">';
    submit_button('Rebuild Pages and Seed Data');
    echo '</form>';
    echo '<h2>Site Options</h2><pre style="max-height:280px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($options, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '<h2>Route Blueprint</h2><pre style="max-height:360px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($routes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '<h2>Collections</h2><pre style="max-height:360px;overflow:auto;background:#fff;padding:16px;border:1px solid #ccd0d4;">' . esc_html(wp_json_encode($collections, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
    echo '</div>';
}

function goodjob_ai_site_handle_reseed() {
    if (!current_user_can('manage_options')) {
        wp_die('Permission denied');
    }
    check_admin_referer('goodjob_ai_site_reseed');
    goodjob_ai_site_seed_all(true);
    wp_safe_redirect(admin_url('admin.php?page=goodjob-ai-site&seeded=1'));
    exit;
}
add_action('admin_post_goodjob_ai_site_reseed', 'goodjob_ai_site_handle_reseed');
`;
  await writeFile(path.join(themeDir, "style.css"), styleCss, "utf8");
  await writeFile(path.join(themeDir, "theme.json"), JSON.stringify(themeJson, null, 2), "utf8");
  await writeFile(path.join(dataDir, "site-options.json"), JSON.stringify(siteOptions, null, 2), "utf8");
  await writeFile(path.join(dataDir, "collections.json"), JSON.stringify(collections, null, 2), "utf8");
  await writeFile(path.join(dataDir, "pages.json"), JSON.stringify(pages, null, 2), "utf8");
  await writeFile(path.join(dataDir, "routes.json"), JSON.stringify(routeBlueprint, null, 2), "utf8");
  await writeFile(path.join(incDir, "cpt.php"), cptPhp, "utf8");
  await writeFile(path.join(incDir, "acf.php"), acfPhp, "utf8");
  await writeFile(path.join(incDir, "installer.php"), installerPhp, "utf8");
  await writeFile(path.join(incDir, "admin.php"), adminPhp, "utf8");
  await writeFile(path.join(templatesDir, "index.html"), frontPageTemplate, "utf8");
  await writeFile(path.join(templatesDir, "front-page.html"), frontPageTemplate, "utf8");
  const archiveTemplates = {
    "archive-product.html": buildAiSiteWpProductsArchiveTemplate(),
    "taxonomy-product_cat.html": buildAiSiteWpProductsArchiveTemplate(),
    "archive-case.html": buildAiSiteWpArchiveTemplate({ title: "Cases", intro: "Explore delivery references, export coordination stories, and project proof from relevant industrial scenarios.", cpt: "case", mediaRatio: "4/3", tone: "case" }),
    "taxonomy-case_cat.html": buildAiSiteWpArchiveTemplate({ title: "Case Category", intro: "Review project references by scenario, market, or delivery type.", cpt: "case", mediaRatio: "4/3", tone: "case" }),
    "archive-news.html": buildAiSiteWpBlogArchiveTemplate(),
    "taxonomy-news_cat.html": buildAiSiteWpBlogArchiveTemplate(),
    "archive-service.html": buildAiSiteWpArchiveTemplate({ title: "Services", intro: "Review pre-sales, export, channel, and after-sales services that support B2B industrial buying.", cpt: "service", mediaRatio: "8/5", tone: "service" }),
    "taxonomy-service_cat.html": buildAiSiteWpArchiveTemplate({ title: "Service Category", intro: "Review service capabilities grouped by support stage and buyer need.", cpt: "service", mediaRatio: "8/5", tone: "service" }),
    "archive.html": buildAiSiteWpArchiveTemplate({ title: "Archive", intro: "Browse the latest published content from this industrial website.", cpt: "post", mediaRatio: "4/3", tone: "generic" }),
    "search.html": buildAiSiteWpSearchTemplate(),
    "404.html": buildAiSiteWp404Template()
  };
  const singleTemplates = {
    "single-product.html": buildAiSiteWpProductDetailTemplate(),
    "single-case.html": buildAiSiteWpSingleTemplate({ cpt: "case", tone: "case", cta: "Want to discuss a similar project or sourcing scenario?" }),
    "single-news.html": buildAiSiteWpNewsDetailTemplate(),
    "single-service.html": buildAiSiteWpSingleTemplate({ cpt: "service", tone: "service", cta: "Need this support for your current export or sourcing project?" }),
    "single.html": buildAiSiteWpSingleTemplate({ cpt: "post", tone: "generic", cta: "Contact the team for more information about this topic." })
  };
  for (const [templateName, templateContent] of Object.entries({ ...archiveTemplates, ...singleTemplates })) {
    await writeFile(path.join(templatesDir, templateName), templateContent, "utf8");
    files.push(`theme/templates/${templateName}`);
  }
  const nativeArchiveBlocks = [
    {
      slug: "products-archive",
      title: "Products Archive",
      icon: "products",
      render: buildAiSiteWpProductsArchiveRender(),
      style: buildAiSiteWpProductsArchiveStyle()
    },
    {
      slug: "blog-archive",
      title: "Blog Archive",
      icon: "media-document",
      render: buildAiSiteWpBlogArchiveRender(),
      style: buildAiSiteWpBlogArchiveStyle()
    },
    {
      slug: "product-detail",
      title: "Product Detail",
      icon: "products",
      render: buildAiSiteWpProductDetailRender(),
      style: buildAiSiteWpProductDetailStyle()
    },
    {
      slug: "news-detail",
      title: "News Detail",
      icon: "media-document",
      render: buildAiSiteWpNewsDetailRender(),
      style: buildAiSiteWpNewsDetailStyle()
    }
  ] as const;
  for (const block of nativeArchiveBlocks) {
    const blockDir = path.join(blocksDir, block.slug);
    await mkdir(blockDir, { recursive: true });
    await writeFile(path.join(blockDir, "block.json"), JSON.stringify(buildAiSiteWpNativeArchiveBlockJson(block.slug, block.title, block.icon), null, 2), "utf8");
    await writeFile(path.join(blockDir, "render.php"), block.render, "utf8");
    await writeFile(path.join(blockDir, "style.css"), block.style, "utf8");
    files.push(`theme/blocks/${block.slug}/block.json`, `theme/blocks/${block.slug}/render.php`, `theme/blocks/${block.slug}/style.css`);
  }
  const functionsPhp = `<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once get_stylesheet_directory() . '/inc/cpt.php';
require_once get_stylesheet_directory() . '/inc/acf.php';
require_once get_stylesheet_directory() . '/inc/installer.php';
require_once get_stylesheet_directory() . '/inc/admin.php';

function goodjob_ai_site_enqueue_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
    wp_enqueue_script(
        'goodjob-ai-site-script',
        get_stylesheet_directory_uri() . '/assets/js/goodjob-site.js',
        array(),
        $theme->get('Version'),
        true
    );
}
add_action('wp_enqueue_scripts', 'goodjob_ai_site_enqueue_assets');

function goodjob_ai_site_enqueue_editor_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-editor-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
}
add_action('enqueue_block_editor_assets', 'goodjob_ai_site_enqueue_editor_assets');

function goodjob_ai_site_theme_setup() {
    add_theme_support('post-thumbnails');
    add_theme_support('title-tag');
    add_theme_support('wp-block-styles');
    add_theme_support('align-wide');
}
add_action('after_setup_theme', 'goodjob_ai_site_theme_setup');
`;
  await writeFile(path.join(themeDir, "functions.php"), functionsPhp, "utf8");
  await writeFile(path.join(assetsJsDir, "goodjob-site.js"), aiSiteWpThemeScript(), "utf8");
  await writeFile(path.join(exportDir, "README.md"), readme, "utf8");
  await writeFile(path.join(exportDir, "wp-metadata.json"), JSON.stringify(state.wpMetadata, null, 2), "utf8");
  await writeFile(path.join(exportDir, "conversion-report.json"), JSON.stringify({ exportedAt, projectId: project.id, themeSlug, summary: state.summary, checks: state.checks }, null, 2), "utf8");
  files.push("theme/style.css", "theme/theme.json", "theme/templates/index.html", "theme/templates/front-page.html", "theme/functions.php", "theme/assets/js/goodjob-site.js", "theme/inc/cpt.php", "theme/inc/acf.php", "theme/inc/installer.php", "theme/inc/admin.php", "theme/_data/site-options.json", "theme/_data/collections.json", "theme/_data/pages.json", "theme/_data/routes.json", "README.md", "wp-metadata.json", "conversion-report.json");

  return { ...state, export: { exportDir, themeDir, themeSlug, exportedAt, files } };
}

async function installAiSiteWpRebuildPackage(project: AiSiteBuilderProject, wordpressRoot: string, themeSlugInput?: string, overwrite = false) {
  const root = path.resolve(String(wordpressRoot || ""));
  if (!root || !(await fileExists(root))) throw new Error("WordPress root does not exist.");
  const wpConfigPath = path.join(root, "wp-config.php");
  const wpContentDir = path.join(root, "wp-content");
  const themesDir = path.join(wpContentDir, "themes");
  const hasWpConfig = await fileExists(wpConfigPath);
  const hasThemesDir = await fileExists(themesDir);
  if (!hasWpConfig && !hasThemesDir) {
    throw new Error("WordPress root must contain wp-config.php or wp-content/themes.");
  }
  const exported = await exportAiSiteWpRebuildPackage(project);
  const themeSlug = cleanAiSiteWpThemeSlug(themeSlugInput, exported.export.themeSlug);
  await mkdir(themesDir, { recursive: true });
  const writeProbe = path.join(themesDir, `.goodjob-install-probe-${Date.now()}.tmp`);
  try {
    await writeFile(writeProbe, "ok", "utf8");
    await rm(writeProbe, { force: true });
  } catch (error) {
    throw new Error(`WordPress themes directory is not writable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const targetDir = path.join(themesDir, themeSlug);
  const targetExistsBefore = await fileExists(targetDir);
  let backupDir = "";
  if (await fileExists(targetDir)) {
    if (!overwrite) throw new Error("Target WordPress theme already exists. Rename the theme slug or enable overwrite after backup.");
    const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupDir = path.join(themesDir, `${themeSlug}.backup-${backupStamp}`);
    await rename(targetDir, backupDir);
  }
  try {
    await cp(exported.export.themeDir, targetDir, { recursive: true });
  } catch (error) {
    if (backupDir && !(await fileExists(targetDir)) && (await fileExists(backupDir))) {
      await rename(backupDir, targetDir).catch(() => undefined);
    }
    throw new Error(`Failed to copy WordPress theme: ${error instanceof Error ? error.message : String(error)}`);
  }

  const requiredFiles = [
    "style.css",
    "functions.php",
    "templates/front-page.html",
    "templates/archive-product.html",
    "templates/single-product.html",
    "templates/archive-news.html",
    "templates/single-news.html",
    "blocks/products-archive/block.json",
    "blocks/products-archive/render.php",
    "blocks/blog-archive/block.json",
    "blocks/blog-archive/render.php",
    "blocks/product-detail/block.json",
    "blocks/product-detail/render.php",
    "blocks/news-detail/block.json",
    "blocks/news-detail/render.php",
    "_data/collections.json",
    "_data/pages.json",
    "_data/routes.json",
    "inc/cpt.php",
    "inc/installer.php",
    "inc/admin.php"
  ];
  const checks = await Promise.all(requiredFiles.map(async (relativePath) => ({
    file: relativePath,
    exists: await fileExists(path.join(targetDir, relativePath))
  })));
  const missingFiles = checks.filter((check) => !check.exists).map((check) => check.file);
  if (missingFiles.length) {
    throw new Error(`WordPress theme installation is incomplete. Missing files: ${missingFiles.join(", ")}`);
  }
  const routeHints = {
    home: "/",
    products: "/products/",
    productDetail: "/product/{product-slug}/",
    blog: "/blog/",
    newsDetail: "/news/{news-slug}/",
    contact: "/contact-us/"
  };
  const nextSteps = [
    "Activate the installed theme in wp-admin > Appearance > Themes.",
    "Open wp-admin > GoodJob AI Site and run the seed/rebuild action if pages or CPT content are empty.",
    "Open wp-admin > Settings > Permalinks and click Save Changes if product/news detail URLs return 404.",
    "Confirm Products and News have published sample items before testing single routes."
  ];
  const install = {
    wordpressRoot: root,
    themeSlug,
    targetDir,
    overwrite,
    backupDir: backupDir || null,
    installedAt: new Date().toISOString(),
    preflight: {
      hasWpConfig,
      hasWpContent: await fileExists(wpContentDir),
      hasThemesDir: await fileExists(themesDir),
      targetExistsBefore,
      sourceThemeDir: exported.export.themeDir
    },
    checks,
    routeHints,
    nextSteps
  };
  await writeFile(path.join(targetDir, "install-report.json"), JSON.stringify({ projectId: project.id, install }, null, 2), "utf8");
  return { ...exported, install };
}

function canSeeAiSiteProject(user: SessionUser, project: { ownerId: string; teamId: string }) {
  return user.role === "admin" || user.role === "super_admin" || user.id === project.ownerId || (user.role === "manager" && user.teamId === project.teamId);
}

const aiSiteModelPresets = [
  { provider: "openai", label: "OpenAI 兼容接口", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  { provider: "deepseek", label: "DeepSeek 深度求索", model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
  { provider: "qwen", label: "通义千问", model: "qwen-plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { provider: "doubao", label: "豆包", model: "doubao-pro-32k", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  { provider: "claude", label: "Claude 模型", model: "claude-3-5-sonnet-latest", baseUrl: "https://api.anthropic.com/v1" },
  { provider: "gemini", label: "Gemini 模型", model: "gemini-1.5-pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { provider: "ollama", label: "Ollama 本地模型", model: "llama3.1", baseUrl: "http://127.0.0.1:11434/v1" },
  { provider: "custom", label: "自定义模型", model: "", baseUrl: "" }
];

function aiSiteProviderProtocol(provider: string): AiModelConfig["protocol"] {
  if (provider === "claude") return "anthropic";
  if (provider === "gemini") return "gemini";
  return "openai-compatible";
}

async function testAiSiteBuilderModel(settings: AiSiteBuilderSetting) {
  const missing = [
    settings.provider ? "" : "供应商",
    settings.model ? "" : "模型名称",
    settings.baseUrl ? "" : "接口地址",
    settings.apiKey || settings.provider === "ollama" ? "" : "接口密钥"
  ].filter(Boolean);
  if (missing.length) {
    return { ok: false, message: `缺少${missing.join("、")}，暂不能进入生成链路` };
  }
  if (process.env.NODE_ENV === "test") {
    return { ok: true, message: "本地配置检查通过；测试环境已跳过外部模型调用" };
  }
  const config: AiModelConfig = {
    id: `ai_site_${settings.ownerId}`,
    provider: settings.provider,
    protocol: aiSiteProviderProtocol(settings.provider),
    name: "AI建站模型配置",
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    enabled: settings.enabled,
    temperature: 0.1,
    useLeadFinder: false,
    useWebsiteParse: false,
    useScoring: false,
    useEmailDraft: false,
    useExam: false,
    ownerId: settings.ownerId,
    teamId: settings.teamId,
    updatedAt: settings.updatedAt
  };
  return testAiConfig(config);
}

function aiSiteSettingsToModelConfig(settings: AiSiteBuilderSetting): AiModelConfig {
  return {
    id: aiSiteMirrorConfigId(settings.ownerId),
    provider: settings.provider,
    protocol: aiSiteProviderProtocol(settings.provider),
    name: "AI建站模型配置",
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    enabled: settings.enabled,
    temperature: 0.25,
    useLeadFinder: false,
    useWebsiteParse: false,
    useScoring: false,
    useEmailDraft: false,
    useExam: false,
    ownerId: settings.ownerId,
    teamId: settings.teamId,
    updatedAt: settings.updatedAt
  };
}

function aiSiteMirrorConfigId(ownerId: string) {
  return `ai_site_${ownerId}`;
}

function aiSiteSettingFromAiConfig(config: AiModelConfig, user: SessionUser): AiSiteBuilderSetting {
  return {
    ownerId: user.id,
    teamId: user.teamId,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    enabled: config.enabled,
    lastTestStatus: config.lastTestStatus || "untested",
    lastTestMessage: config.lastTestMessage || "",
    updatedAt: new Date().toISOString()
  };
}

async function syncAiSiteSettingFromAiConfig(config: AiModelConfig, user: SessionUser) {
  if (config.ownerId !== user.id) return;
  const store = getStore();
  const next = aiSiteSettingFromAiConfig(config, user);
  const index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === user.id);
  if (index >= 0) store.aiSiteBuilderSettings[index] = next;
  else store.aiSiteBuilderSettings.push(next);
  await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
}

function upsertAiConfigFromAiSiteSetting(settings: AiSiteBuilderSetting) {
  const store = getStore();
  const id = aiSiteMirrorConfigId(settings.ownerId);
  const existing = store.aiModelConfigs.find((item) => item.id === id && item.ownerId === settings.ownerId);
  const next: AiModelConfig = {
    id,
    provider: settings.provider,
    protocol: aiSiteProviderProtocol(settings.provider),
    name: existing?.name || "AI建站模型配置",
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    enabled: settings.enabled,
    temperature: existing?.temperature ?? 0.25,
    useLeadFinder: existing?.useLeadFinder ?? true,
    useWebsiteParse: existing?.useWebsiteParse ?? true,
    useScoring: existing?.useScoring ?? true,
    useEmailDraft: existing?.useEmailDraft ?? true,
    useExam: existing?.useExam ?? false,
    lastTestAt: existing?.lastTestAt,
    lastTestStatus: settings.lastTestStatus || existing?.lastTestStatus || "untested",
    lastTestMessage: settings.lastTestMessage || existing?.lastTestMessage || "",
    ownerId: settings.ownerId,
    teamId: settings.teamId,
    updatedAt: settings.updatedAt
  };
  if (existing) Object.assign(existing, next);
  else store.aiModelConfigs.unshift(next);
  return existing || next;
}

function aiSiteModelReady(settings?: AiSiteBuilderSetting) {
  return Boolean(settings?.model && settings.baseUrl && (settings.apiKey || settings.provider === "ollama"));
}

function stripUnsafeAiSiteHtml(value: unknown, sectionKey: AiSiteSectionKey) {
  let html = String(value || "").trim();
  html = html
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\shref\s*=\s*"(?!#|mailto:|tel:)[^"]*"/gi, " href=\"#\"")
    .replace(/\shref\s*=\s*'(?!#|mailto:|tel:)[^']*'/gi, " href=\"#\"")
    .replace(/\starget\s*=\s*"[^"]*"/gi, "")
    .replace(/\starget\s*=\s*'[^']*'/gi, "")
    .trim();
  if (/logoutButton|login-screen|GoodJob CRM|data-view="dashboard"|id="appModal"/i.test(html)) {
    throw new Error("模型返回疑似包含 CRM 主系统内容，已拒绝写入");
  }
  const fragment = html.match(/<(section|header|footer)\b[\s\S]*<\/\1>/i)?.[0];
  if (fragment) html = fragment.trim();
  if (!/^<(section|header|footer)\b/i.test(html)) {
    throw new Error("模型必须只返回一个 header/footer/section HTML 片段");
  }
  const expectedId = sectionKey === "hero" ? "(?:home|hero)" : sectionKey.replace(/_/g, "-");
  if (sectionKey !== "header" && sectionKey !== "footer" && !new RegExp(`<section\\b[\\s\\S]*id=["']${expectedId}["']`, "i").test(html)) {
    html = html.replace(/^<section\b/i, `<section id="${sectionKey === "hero" ? "home" : sectionKey.replace(/_/g, "-")}"`);
  }
  return html;
}

function aiSiteHtmlFromModelOutput(content: string, sectionKey: AiSiteSectionKey) {
  try {
    const parsed = extractJsonObject(content) as { html?: unknown };
    if (parsed.html) return stripUnsafeAiSiteHtml(parsed.html, sectionKey);
  } catch {
    // Some OpenAI-compatible providers ignore JSON mode; use their raw HTML safely.
  }
  return stripUnsafeAiSiteHtml(content, sectionKey);
}

function validateGeneratedAiSiteSectionHtml(html: string, sectionKey: AiSiteSectionKey, project?: AiSiteBuilderProject) {
  if (aiSiteLockedSections.has(sectionKey)) return;
  const sectionId = sectionKey.replace(/_/g, "-");
  const expectedId = sectionKey === "hero" ? "(?:home|hero)" : sectionId;
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1].trim()).filter(Boolean);
  if (!styleBlocks.length) throw new Error(`Generated ${sectionId}.html is missing a scoped <style> block`);
  const css = styleBlocks.join("\n").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  const declarationCount = (css.match(/:[^;{}]+;/g) || []).length;
  const minCssLength = sectionKey === "hero" ? 420 : 520;
  const minDeclarationCount = sectionKey === "hero" ? 18 : 24;
  if (css.length < minCssLength || declarationCount < minDeclarationCount) {
    throw new Error(`Generated ${sectionId}.html CSS is too thin (${declarationCount} declarations)`);
  }
  const scopePattern = new RegExp(sectionKey === "hero" ? "#(?:home|hero)(?:\\b|\\s|[.#:{>])" : `#${sectionId}(?:\\b|\\s|[.#:{>])`, "i");
  if (!scopePattern.test(css)) throw new Error(`Generated ${sectionId}.html CSS is not scoped to #${sectionId}`);
  if (!new RegExp(`<section\\b[\\s\\S]*id=["']${expectedId}["']`, "i").test(html)) {
    throw new Error(`Generated ${sectionId}.html is missing the required section id`);
  }
  if (sectionKey !== "hero" && !/class=["'][^"']*\bai-section\b/i.test(html)) {
    throw new Error(`Generated ${sectionId}.html must use the shared ai-section framework class`);
  }
  if (sectionKey === "hero") {
    if (/@keyframes\s*#/i.test(css) || /animation(?:-[a-z-]+)?\s*:\s*#/i.test(css)) {
      throw new Error("Generated hero.html contains an invalid # keyframe/animation name");
    }
    if ((html.match(/data-upload-slot=["']hero-background-/gi) || []).length < 3) {
      throw new Error("Generated hero.html must include 3 data-upload-slot hero background hooks");
    }
  }
  if (sectionKey === "contact_us") {
    const inputCount = (html.match(/<input\b/gi) || []).length;
    if (!/<form\b/i.test(html)) throw new Error("Generated contact-us.html must include a real inquiry <form>");
    if (inputCount < 5) throw new Error("Generated contact-us.html must include name, country, email, product/project type, and target capacity inputs");
    if (!/<textarea\b/i.test(html)) throw new Error("Generated contact-us.html must include a project details textarea");
    if (!/SEND\s+INQUIRY|Request\s+a\s+Free\s+Proposal/i.test(html)) throw new Error("Generated contact-us.html must include the fixed inquiry form CTA");
  }
  if (sectionKey === "products" || sectionKey === "applications" || sectionKey === "about_us") {
    if (/linear-gradient\([^)]*\b(\d{1,2})%\s*,\s*#[0-9a-f]{3,8}\s+\1%/i.test(css)) {
      throw new Error(`Generated ${sectionId}.html uses a hard-split background that can create broken half-color bands`);
    }
    if (/href=["']#["']/i.test(html)) {
      throw new Error(`Generated ${sectionId}.html contains inert href="#" controls; use #contact-us or script-free radio label controls`);
    }
  }
  if (sectionKey !== "hero" && !aiSiteLockedSections.has(sectionKey)) {
    const linearGradientCount = (css.match(/linear-gradient\s*\(/gi) || []).length;
    if (/radial-gradient\s*\(/i.test(css) || linearGradientCount > 1) {
      throw new Error(`Generated ${sectionId}.html overuses decorative gradients; use solid/tinted surfaces and structured panels instead`);
    }
  }
  if (sectionKey === "products") {
    if (!/products-category-showcase/i.test(html)) throw new Error("Generated products.html must keep the products-category-showcase structure");
    if (!/<(button|label)\b[\s\S]*(products|category|pill|tab)/i.test(html)) throw new Error("Generated products.html must include clickable category controls");
    if (!/data-product-category=["']/i.test(html)) throw new Error("Generated products.html category controls must include data-product-category hooks");
    if ((html.match(/<article\b/gi) || []).length < 4) throw new Error("Generated products.html must include at least 4 product preview cards");
  }
  if (sectionKey === "applications") {
    if (!/applications-horizontal-card-preview/i.test(html)) throw new Error("Generated applications.html must keep the horizontal application card preview structure");
    if ((html.match(/<article\b/gi) || []).length < 3) throw new Error("Generated applications.html must include at least 3 application preview cards");
  }
  if (sectionKey === "about_us") {
    if (!/about-us-capability-stack-and-quality-process/i.test(html)) throw new Error("Generated about-us.html must keep the capability stack and quality process structure");
    if (!/capability/i.test(html) || !/(quality|inspection|documentation|process)/i.test(html)) throw new Error("Generated about-us.html must include capability and quality/process proof content");
  }
  if (project && !aiSiteLockedSections.has(sectionKey)) {
    const design = aiSiteDesignSystem(project);
    const userColors = [
      design.palette.brand,
      design.palette.accent,
      design.palette.surface,
      design.palette.brandDeep,
      design.palette.dark
    ].map((color) => color.toLowerCase());
    const cssText = css.toLowerCase();
    const usesPaletteLiteral = userColors.some((color) => cssText.includes(color));
    const usesFrameworkToken = /var\(--(?:blue|red|blue-deep|bg-soft|footer|ink|body|mid|line)\b/i.test(css);
    if (!usesPaletteLiteral && !usesFrameworkToken) {
      throw new Error(`Generated ${sectionId}.html does not use the project palette or framework color tokens`);
    }
  }
  if (!/@media/i.test(css)) throw new Error(`Generated ${sectionId}.html CSS is missing responsive @media rules`);
  if (!/(clamp\(|minmax\(|auto-fit|grid-template-columns|flex-wrap)/i.test(css)) {
    throw new Error(`Generated ${sectionId}.html CSS is missing responsive layout primitives`);
  }
  if (/(^|[}\s,])(body|html|:root)\s*\{/i.test(css)) {
    throw new Error(`Generated ${sectionId}.html CSS contains unsafe global selectors`);
  }
}

type AiSiteSectionLayoutStrategy = {
  family: string;
  variant: AiSiteSectionVariantMeta;
  blueprintSignals: string[];
  composition: string[];
  requiredElements: string[];
  avoid: string[];
};

function aiSiteBlueprintSignals(plan: string, schema: ReturnType<typeof normalizeAiSiteSchemaData>) {
  const text = plan.toLowerCase();
  const categories = sectionArray(schema.business_taxonomy.product_categories);
  const signals = [
    categories.length ? `${Math.min(categories.length, 10)} product families available` : "no product families supplied",
    schema.contact_info.phone ? "phone CTA available" : "",
    schema.contact_info.email ? "email CTA available" : "",
    schema.company_profile.description ? "company description available" : ""
  ];
  if (/cert|quality|iso|test|inspection|factory|manufactur/i.test(text)) signals.push("quality/manufacturing proof");
  if (/case|project|deliver|result|export|buyer|value/i.test(text)) signals.push("delivery proof");
  if (/application|scenario|environment|pain|operating/i.test(text)) signals.push("application scenario logic");
  if (/seo|guide|knowledge|article|insight|blog/i.test(text)) signals.push("editorial/SEO intent");
  return signals.filter(Boolean).slice(0, 8);
}

function aiSiteSectionLayoutStrategy(project: AiSiteBuilderProject, sectionKey: AiSiteSectionKey): AiSiteSectionLayoutStrategy {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const blueprint = cleanAiSiteBlueprint(project);
  const plan = blueprint[sectionKey] || "";
  const styleProfile = aiSiteDesignSystem(project).styleProfile;
  const categories = sectionArray(schema.business_taxonomy.product_categories);
  const signals = [
    `style mood: ${styleProfile.mood}`,
    `style density: ${styleProfile.density}`,
    `style geometry: ${styleProfile.shape}`,
    `style composition: ${styleProfile.composition}`,
    ...aiSiteBlueprintSignals(plan, schema)
  ];
  const categoryInstruction = categories.length
    ? `Use these category labels as real content anchors: ${categories.slice(0, 10).join(", ")}.`
    : "Create realistic industrial category labels from the company description.";
  const variantSpec = aiSiteSelectVariantSpec(project, sectionKey);
  const variant = aiSiteSectionVariantMeta(variantSpec);

  const strategies: Record<AiSiteSectionKey, Omit<AiSiteSectionLayoutStrategy, "variant">> = {
    header: {
      family: "locked_fixed_header",
      blueprintSignals: signals,
      composition: ["Locked framework component; do not generate with this prompt."],
      requiredElements: [],
      avoid: []
    },
    hero: {
      family: "darkened_photo_hero_slider",
      blueprintSignals: signals,
      composition: [
        "Build one compact full-width hero section that visually occupies about 72vh.",
        "Use 3 external industrial photo backgrounds with a dark overlay strong enough for clear white text.",
        "Create a company-specific headline from the form data; do not force a generic Industrial ... formula. Keep the H1 visually to 2 lines maximum.",
        "Place eyebrow, oversized H1, short subtitle, and exactly two buttons: Request a Proposal and Learn More.",
        "Put working previous/next square controls plus a current slide indicator such as 01 / 03 in the bottom-right corner.",
        "Use script-free HTML/CSS radio inputs and labels for manual switching; use CSS keyframes for automatic background switching every 6 seconds."
      ],
      requiredElements: ["one H1 clamped to 2 lines", "one subtitle paragraph", "exactly two CTA links", "3 darkened image backgrounds", "working bottom-right prev/next controls", "slide status indicator", "CSS auto-switch every 6 seconds", "data-upload-slot markers for future custom image upload"],
      avoid: ["cards", "metrics", "proof strip", "stats rail", "grids", "decorative panels", "extra content blocks", "two-column split"]
    },
    products: {
      family: "product_category_tabs_catalog_slider",
      blueprintSignals: [...signals, categoryInstruction],
      composition: [
        "Build a reference-style Product Category catalog section from top to bottom.",
        "Start with a centered Product Category heading and one concise explanatory line.",
        "Place product category pill buttons in a horizontal wrapped row; highlight the current category.",
        "Below the buttons, show the current category product catalog as large image cards with uppercase product names.",
        "Put previous/next browsing arrows on the left and right sides of the product card stage; use script-free radio inputs and labels if interaction is needed."
      ],
      requiredElements: ["Product Category h2", "one explanation paragraph", "category pill buttons", "4 visible product cards", "left and right browsing arrows", "responsive catalog grid"],
      avoid: ["specification matrix", "proof strip", "identical 3-card layout", "plain list only", "image-left text-right split", "crowded card columns"]
    },
    applications: {
      family: "applications_horizontal_card_preview",
      blueprintSignals: signals,
      composition: [
        "Create a horizontal application card preview section.",
        "Start with a readable title block, then a row of wide application cards that preview operating environment, buyer pain point, suitable product, and outcome.",
        "Use a full-surface background and card surfaces; do not split the section background with hard percentage color stops.",
        "Cards may scroll or wrap, but the desktop first view should feel like a horizontal preview carousel.",
        "Keep all CTA controls clickable and above decorative layers."
      ],
      requiredElements: ["3-5 horizontal application cards", "pain point labels", "matching product chips", "outcome notes", "clickable CTA to #contact-us", "high-contrast headings on dark or light backgrounds"],
      avoid: ["hard-split gradient bands", "low-contrast dark text on blue backgrounds", "same product card layout", "generic features grid", "two-column split", "decorative overlays covering controls"]
    },
    about_us: {
      family: "capability_stack_and_quality_process",
      blueprintSignals: signals,
      composition: [
        "Use a refined institutional About Us section with a clear title block, capability stack, documentation proof, reliability note, and quality/export process belt.",
        "Use one continuous full-surface background; do not split the section background with hard percentage color stops.",
        "Place dark panels and light cards as deliberate surfaces, with explicit text colors for every heading and paragraph group.",
        "Show the company as an operating system: facilities, standards, response, documentation.",
        "Make this section calmer and more institutional than Products or Applications."
      ],
      requiredElements: ["capability stack", "quality/export process", "documentation or certification proof", "company reliability statement", "high-contrast headings on dark or light backgrounds", "CTA to #contact-us"],
      avoid: ["hard-split gradient bands", "low-contrast dark text on blue backgrounds", "founder story card grid", "same 3-column cards", "left text plus right image", "oversized decorative badge", "decorative overlays covering controls"]
    },
    blog: {
      family: "industrial_editorial_digest",
      blueprintSignals: signals,
      composition: [
        "Use an editorial layout: one featured guide, then compact article rows or a knowledge index.",
        "Organize posts by buyer intent such as selection guide, maintenance, troubleshooting, and market insight.",
        "Include SEO tags or reading paths so it does not look like another product grid.",
        "Use white space and typography to make it feel like an industrial knowledge center."
      ],
      requiredElements: ["featured article", "3-4 article rows", "SEO/intent tags", "knowledge CTA"],
      avoid: ["same cards as Products", "large equal blocks only", "fake news feed clutter", "two-column split"]
    },
    contact_us: {
      family: "inquiry_command_center",
      blueprintSignals: signals,
      composition: [
        "Build a fixed inquiry section with a left trust/CTA column and a right buyer inquiry form panel.",
        "The form panel is mandatory and must stay visible as the primary conversion element.",
        "Use compact contact method strips, inquiry checklist, and response promise inside or below the left column.",
        "Place phone/email/location/social data as operational channels, not oversized cards.",
        "On mobile, stack the trust column before the inquiry form while preserving all form fields."
      ],
      requiredElements: ["left trust/CTA column", "right white inquiry form panel", "real form element", "name input", "country input", "email input", "product/project type input", "target capacity input", "project details textarea", "SEND INQUIRY submit button", "phone/email/location channels when available", "RFQ checklist", "response promise"],
      avoid: ["contact-only cards without form", "map placeholder", "same grid as Footer", "unusable form controls", "form hidden below decorative content"]
    },
    footer: {
      family: "locked_fixed_footer",
      blueprintSignals: signals,
      composition: ["Locked framework component; do not generate with this prompt."],
      requiredElements: [],
      avoid: []
    }
  };

  const selected = strategies[sectionKey] || {
    family: "custom_simple_page",
    blueprintSignals: signals,
    composition: [
      "Build one simple standalone custom page section.",
      "Use a clear heading, concise explanatory copy, one practical content band, and a small CTA row.",
      "Keep the layout easy to edit and suitable for later conversion into a WordPress block."
    ],
    requiredElements: ["custom page heading", "intro copy", "one content band", "CTA row", "responsive single-column mobile layout"],
    avoid: ["full homepage shell", "header/footer duplication", "CRM links", "login/logout controls", "complex multi-section page"]
  };
  return {
    ...selected,
    family: variant.id,
    variant,
    composition: [
      ...selected.composition,
      `Variant contract (${variant.title}): ${variant.structure.join(" -> ")}.`,
      `Variant interactions: ${variant.interactions.join("; ")}.`,
      `Responsive contract: ${variant.responsive}.`
    ],
    requiredElements: [...new Set([...selected.requiredElements, ...variant.structure])],
    avoid: [...new Set([...selected.avoid, ...variant.avoid])]
  };
}

function aiSiteWpRole(sectionKey: AiSiteSectionKey): AiSiteWpSectionMeta["wp_role"] {
  if (sectionKey === "header" || sectionKey === "footer") return "template-part";
  if (!aiSiteSectionLabel(sectionKey)) return "custom-page-section";
  return "block";
}

function aiSiteWpTarget(sectionKey: AiSiteSectionKey, layoutVariant: string) {
  if (sectionKey === "header") return "template-parts/header.html";
  if (sectionKey === "footer") return "template-parts/footer.html";
  const targets: Record<string, string> = {
    hero: "blocks/hero-photo-slider",
    products: "blocks/products-category-catalog",
    applications: "blocks/applications-scenario-map",
    about_us: "blocks/about-capability-stack",
    blog: "blocks/recent-blogs-split",
    contact_us: "blocks/contact-inquiry-form"
  };
  if (targets[sectionKey]) return targets[sectionKey];
  return `patterns/${layoutVariant.replace(/_/g, "-")}`;
}

function aiSiteWpSectionType(sectionKey: AiSiteSectionKey) {
  if (sectionKey === "header" || sectionKey === "footer") return "template_part";
  if (!aiSiteSectionLabel(sectionKey)) return "custom_page";
  return sectionKey;
}

function buildAiSiteWpSectionMeta(project: AiSiteBuilderProject, sectionKey: AiSiteSectionKey, orderIndex: number, customPages: AiSiteCustomPageMeta[], existing?: Partial<AiSiteWpSectionMeta>): AiSiteWpSectionMeta {
  const label = aiSiteSectionLabel(sectionKey, customPages);
  const strategy = aiSiteSectionLayoutStrategy(project, sectionKey);
  const variant = strategy.variant;
  const layoutVariant = existing?.layout_variant || strategy.family;
  const locked = aiSiteLockedSections.has(sectionKey);
  return {
    section_key: sectionKey,
    label,
    section_type: aiSiteWpSectionType(sectionKey),
    layout_variant: layoutVariant,
    variant_title: variant.title,
    variant,
    source_file: `sections/${sectionKey}.html`,
    wp_role: existing?.wp_role || aiSiteWpRole(sectionKey),
    wp_target: existing?.wp_target || variant.wp_target || aiSiteWpTarget(sectionKey, layoutVariant),
    status: existing?.status || (locked ? "locked" : "blueprint"),
    locked,
    order_index: orderIndex,
    updated_at: new Date().toISOString()
  };
}

async function readAiSiteWpMetadata(project: AiSiteBuilderProject, order: AiSiteSectionKey[], customPages: AiSiteCustomPageMeta[]) {
  const existing = await readJsonFile<Partial<AiSiteWpMetadata> | null>(aiSiteWpMetadataFile(project.id), null);
  const existingSections = new Map((existing?.sections || []).map((item) => [item.section_key, item]));
  const sections = order.map((sectionKey, index) => buildAiSiteWpSectionMeta(project, sectionKey, index, customPages, existingSections.get(sectionKey)));
  const designSystem = aiSiteDesignSystem(project);
  const metadata: AiSiteWpMetadata = {
    version: "1.1",
    project_id: project.id,
    site_name: project.siteName,
    site_template: existing?.site_template || "b2b_industrial",
    wp_mode: "block-theme",
    updated_at: new Date().toISOString(),
    design_system: {
      version: designSystem.version,
      preset: designSystem.preset,
      palette: designSystem.palette,
      style_profile: designSystem.styleProfile.summary,
      registry_version: "section-variant-registry.v1"
    },
    variant_registry: aiSiteVariantRegistryMeta(),
    sections,
    next_stage: {
      page: "WordPress重构",
      purpose: "Convert checked HTML sections into WordPress block theme parts, patterns, export package, and optional local install.",
      status: "metadata_ready"
    }
  };
  await writeFile(aiSiteWpMetadataFile(project.id), JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}

async function writeAiSiteWpMetadata(metadata: AiSiteWpMetadata) {
  await writeFile(aiSiteWpMetadataFile(metadata.project_id), JSON.stringify(metadata, null, 2), "utf8");
}

function buildAiSiteSectionPrompt(project: AiSiteBuilderProject, sectionKey: AiSiteSectionKey, repairReason = "", userInstruction = "") {
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  const blueprint = cleanAiSiteBlueprint(project);
  const designSystem = aiSiteDesignSystem(project);
  const styleProfile = designSystem.styleProfile;
  const layoutStrategy = aiSiteSectionLayoutStrategy(project, sectionKey);
  const sectionId = sectionKey.replace(/_/g, "-");
  const sectionLabel = aiSiteSectionLabel(sectionKey);
  const variantContract = `Variant registry contract: use variant "${layoutStrategy.variant.id}" (${layoutStrategy.variant.title}). Preserve this structure order: ${layoutStrategy.variant.structure.join(" -> ")}. Enrich only through visual tokens (${layoutStrategy.variant.visual_tokens.join(", ")}), spacing, surfaces, component details, micro-animation, and copy; do not invent a different section type.`;
  const paletteContract = `Palette contract: the user-selected palette is mandatory. Use brand ${designSystem.palette.brand}, accent ${designSystem.palette.accent}, surface ${designSystem.palette.surface}, brandDeep ${designSystem.palette.brandDeep}, and dark ${designSystem.palette.dark} as literal hex values or via framework tokens var(--blue), var(--red), var(--bg-soft), var(--blue-deep), var(--footer). Do not keep default #244aa5/#143A7B/#C8161C/#f97316 unless those exact colors are in the user palette.`;
  const styleExecutionContract = `Style execution contract: user style requirements override the default industrial template. Follow style_profile mood "${styleProfile.mood}", density "${styleProfile.density}", geometry "${styleProfile.shape}", background "${styleProfile.background}", composition "${styleProfile.composition}", CTA "${styleProfile.ctaStyle}", and custom notes "${styleProfile.customNotes || "none"}". If the style mentions retro, Y2K, vintage, old web, millennium, 复古, 千禧, 老网页, or 古早, use boxed old-web surfaces, visible borders, compact typography, nostalgic green/blue/white treatments, and do not output the sleek blue industrial template.`;
  const styleExecutionContractV2 = `Strict style contract v2: user colors, keywords, and custom notes are first-class requirements. Apply the style visibly to at least four layers: section background or surface, card/panel treatment, heading/eyebrow treatment, CTA/button shape, borders/dividers, image treatment, or micro-interaction. Do not satisfy the style by changing only one button color. Raw style input: ${JSON.stringify(schema.style_requirements)}.`;
  const gradientDisciplineContract = sectionKey === "hero"
    ? "Gradient rule: Hero may use dark image overlays only; keep the user palette visible in CTA, badge, slider controls, and overlay tint."
    : "Gradient discipline: do not use broad decorative multi-stop gradients, radial-gradient blobs, glassmorphism, or large diagonal color washes as the main style. Use solid/tinted surfaces, borders, quiet shadows, image areas, chips, and structured panels. At most one subtle two-color linear-gradient is allowed, and it must not create a cheap color wash or broken half-band.";
  if (sectionKey === "hero") {
    const company = schema.company_profile;
    const heroBrief = {
      brand: company.wordmark || company.legal_name || project.siteName,
      tagline: company.tagline,
      description: company.description,
      plan: blueprint.hero,
      palette: designSystem.palette,
      style_profile: styleProfile,
      layout: layoutStrategy
    };
    return [
      "Generate one premium B2B industrial HERO section. Return only JSON: {\"html\":\"...\"}.",
      "Speed mode: keep output compact. No explanations. No markdown.",
      `Required root: <section id="home" class="ai-hero ai-photo-hero">`,
      "First child inside the section must be one scoped <style>. Every selector must start with #home.",
      repairReason ? `Previous output failed validation: ${repairReason}` : "",
      userInstruction ? `User directional instruction: ${userInstruction}` : "",
      variantContract,
      paletteContract,
      styleExecutionContract,
      styleExecutionContractV2,
      gradientDisciplineContract,
      "Hero composition: 3 external industrial photo backgrounds; height about 72vh; dark overlay so white text is clearly readable.",
      "Theme color rule: use the palette from Brief JSON as literal hex colors inside the scoped CSS. The overlay gradient, eyebrow badge, primary CTA, arrow hover/focus state, and status indicator must visibly reflect brand/accent/brandDeep. Do not rely only on CSS variables and do not fall back to the old navy/red palette unless the palette actually matches it.",
      "Style rule: follow Brief JSON style_profile for mood, density, geometry, CTA style, and background treatment while keeping the required hero contract.",
      "Content only: eyebrow badge, H1, one subtitle paragraph, two buttons named exactly Request a Proposal and Learn More.",
      "Headline rule: create a suitable company-specific headline from the form data. Do not force the generic 'Industrial ...' wording. CSS must visually limit H1 to 2 lines with max-width and line clamp or balanced wrapping.",
      "Bottom-right only: working previous/next arrow controls and slide status text like 01 / 03.",
      "Interaction: no script. Use hidden radio inputs plus label controls for manual switching. The exported WordPress theme will also enhance the section with a 6-second slider timer, so keep stable hooks and never name keyframes with # or an ID-like value.",
      "Future upload hook: add data-hero-image-api=\"/api/ai-site-builder/projects/{projectId}/hero-backgrounds\" on the section and data-upload-slot=\"hero-background-1/2/3\" on each background element.",
      "Do not add cards, metrics, proof strips, stats, grids, side panels, extra sections, forms, testimonials, or product lists.",
      "Use reliable external image URLs in CSS background-image, preferably industrial plant/factory/mining/manufacturing photos from images.unsplash.com with auto=format&fit=crop&w=1800&q=80. If unsure, use neutral placeholder background URLs and keep upload hooks.",
      "CSS quality: 24-56 declarations, include @media(max-width:760px), use clamp(), min-height:72vh, background-size:cover, and safe 16:9 spacing.",
      "Links: Request a Proposal href=\"#contact-us\"; Learn More href=\"#products\". No external links except the CSS background image URL.",
      "Brief JSON: " + JSON.stringify(heroBrief)
    ].filter(Boolean).join("\n");
  }
  if (sectionKey === "products") {
    const productsBrief = {
      categories: sectionArray(schema.business_taxonomy.product_categories),
      brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
      plan: blueprint.products,
      palette: designSystem.palette,
      style_profile: styleProfile,
      layout: layoutStrategy
    };
    return [
      "Generate one premium B2B industrial PRODUCTS catalog section. Return only JSON: {\"html\":\"...\"}.",
      "Speed mode: compact output. No explanations. No markdown.",
      `Required root: <section id="${sectionId}" class="ai-section products-category-showcase">`,
      "First child inside the section must be one scoped <style>. Every selector must start with #products.",
      repairReason ? `Previous output failed validation: ${repairReason}` : "",
      userInstruction ? `User directional instruction: ${userInstruction}` : "",
      variantContract,
      paletteContract,
      styleExecutionContract,
      styleExecutionContractV2,
      gradientDisciplineContract,
      "Layout must match this top-to-bottom order: Product Category heading, one explanation paragraph, category pill buttons, current category product catalog cards, left/right browsing arrows.",
      "Style rule: follow Brief JSON style_profile for mood, density, geometry, card treatment, CTA shape, and background treatment. Keep global consistency but avoid copying the same visual formula as Hero or other sections.",
      "Cards: show 4 large product cards in the first view. Each card needs a square or near-square product image area, uppercase product name, and a small bottom-right inquiry arrow.",
      "Background safety: do not use hard-split linear-gradient backgrounds such as dark 18% then light 18%; use one continuous section background plus separate card/tab surfaces. Avoid absolute decorative layers unless they have pointer-events:none and z-index below content.",
      "Contrast safety: headings, tabs, product names, and arrows must have WCAG-like readable contrast. Never put dark gray or black text directly on a dark blue background; use white/light text on dark surfaces and dark text on light cards.",
      "Interaction: no script. Browsing arrows must be <label> controls for hidden radio inputs and must visibly switch product pages. Category controls must be real <button type=\"button\" class=\"products-tab\" data-product-category=\"Category Name\"> controls, not inert spans. The exported WordPress theme JS uses data-product-category to switch the active category and update visible cards.",
      "Clickable links: product inquiry arrows must use href=\"#contact-us\". Do not output href=\"#\".",
      "Images: use realistic product image URLs when safe, otherwise use placeholder URLs such as https://placehold.co/560x420/f8fafc/244aa5?text=Product. Do not use external page links.",
      "Avoid: specification matrix, proof strip, generic 3-card layout, image-left text-right split, forms, testimonials, CRM/login/logout/app links.",
      "CSS quality: 28-64 declarations, include @media(max-width:760px), use grid-template-columns, minmax() or clamp(), and avoid fixed widths over 420px.",
      "Copy: English, concise, product-buyer focused. Use the product categories from the JSON as button labels and card naming anchors.",
      "Brief JSON: " + JSON.stringify(productsBrief)
    ].filter(Boolean).join("\n");
  }
  if (sectionKey === "applications") {
    const applicationsBrief = {
      categories: sectionArray(schema.business_taxonomy.product_categories),
      brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
      plan: blueprint.applications,
      palette: designSystem.palette,
      style_profile: styleProfile,
      layout: layoutStrategy
    };
    return [
      "Generate one premium B2B industrial APPLICATIONS horizontal card preview section. Return only JSON: {\"html\":\"...\"}.",
      "Speed mode: compact output. No explanations. No markdown.",
      `Required root: <section id="${sectionId}" class="ai-section applications-horizontal-card-preview">`,
      "First child inside the section must be one scoped <style>. Every selector must start with #applications.",
      repairReason ? `Previous output failed validation: ${repairReason}` : "",
      userInstruction ? `User directional instruction: ${userInstruction}` : "",
      variantContract,
      paletteContract,
      styleExecutionContract,
      styleExecutionContractV2,
      gradientDisciplineContract,
      "Layout contract: top readable title block, then a horizontal preview row of 3-5 application cards. Each card maps operating environment -> buyer pain point -> suitable product/category -> outcome.",
      "Structure contract: use <article> for each application card. Cards should be wide, visually distinct, and arranged with grid-auto-flow:column, overflow-x:auto, scroll-snap, or a responsive grid that reads horizontally on desktop.",
      "Preserve Applications direction: this is not a vertical process lane and not a generic feature grid. It must look like a horizontal application card preview.",
      "Background safety: do not use hard-split linear-gradient backgrounds such as dark 22% then light 22%; use one continuous section background plus card surfaces. If decorative pseudo-elements are used, set pointer-events:none and keep them behind content.",
      "Contrast safety: all text on dark blue/brand surfaces must be white or very light. All gray body text must sit on light cards. Eyebrow labels must not be gray on blue.",
      "Interaction safety: CTA buttons and card links must use href=\"#contact-us\" or href=\"#products\". Do not output href=\"#\". Decorative layers must not cover links.",
      "Required content: 3-5 application cards, pain point label, product/category chips, outcome note, one CTA to #contact-us.",
      "CSS quality: 30-68 declarations, include @media(max-width:760px), use clamp(), minmax(), grid-template-columns or grid-auto-flow, and avoid fixed card widths over 420px.",
      "Copy: English, concrete, buyer-facing, 100-190 words max. Use real product/category clues from JSON.",
      "Brief JSON: " + JSON.stringify(applicationsBrief)
    ].filter(Boolean).join("\n");
  }
  if (sectionKey === "about_us") {
    const aboutBrief = {
      brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
      company: schema.company_profile,
      categories: sectionArray(schema.business_taxonomy.product_categories),
      plan: blueprint.about_us,
      palette: designSystem.palette,
      style_profile: styleProfile,
      layout: layoutStrategy
    };
    return [
      "Generate one premium B2B industrial ABOUT US capability and quality process section. Return only JSON: {\"html\":\"...\"}.",
      "Speed mode: compact output. No explanations. No markdown.",
      `Required root: <section id="${sectionId}" class="ai-section about-us-capability-stack-and-quality-process">`,
      "First child inside the section must be one scoped <style>. Every selector must start with #about-us.",
      repairReason ? `Previous output failed validation: ${repairReason}` : "",
      userInstruction ? `User directional instruction: ${userInstruction}` : "",
      variantContract,
      paletteContract,
      styleExecutionContract,
      styleExecutionContractV2,
      gradientDisciplineContract,
      "Layout contract: readable title block, capability stack panel, documentation/proof card, reliability card, and a quality/export process belt.",
      "Background safety: do not use hard-split linear-gradient backgrounds such as dark 34% then light 34%; use one continuous background plus deliberate dark panels and white cards.",
      "Contrast safety: every heading on dark panels must explicitly use white or very light color. Body text on dark panels must use rgba(255,255,255,.76+) or equivalent. Gray text may only sit on white/light surfaces.",
      "Surface rule: keep dark surfaces and light cards visually separated with spacing, not by cutting the whole section background in half.",
      "Required content: 4 capability stack items, documentation/proof list, long-term reliability note, 4-step quality/export process, and one CTA link to #contact-us.",
      "Interaction safety: CTA links must use href=\"#contact-us\". Do not output href=\"#\" or href=\"#contact\".",
      "Style rule: follow Brief JSON style_profile for mood, density, geometry, card treatment, CTA style, and palette while keeping a calm institutional About section.",
      "CSS quality: 34-72 declarations, include @media(max-width:760px), use clamp(), minmax(), grid-template-columns or auto-fit, and avoid fixed widths over 520px.",
      "Copy: English, concrete, buyer-facing, 130-230 words max. Use company/category clues from JSON.",
      "Brief JSON: " + JSON.stringify(aboutBrief)
    ].filter(Boolean).join("\n");
  }
  if (sectionKey === "contact_us") {
    const contactBrief = {
      brand: schema.company_profile.wordmark || schema.company_profile.legal_name || project.siteName,
      company: schema.company_profile,
      contact: schema.contact_info,
      categories: sectionArray(schema.business_taxonomy.product_categories),
      plan: blueprint.contact_us,
      palette: designSystem.palette,
      style_profile: styleProfile,
      layout: layoutStrategy
    };
    return [
      "Generate one premium B2B industrial CONTACT US inquiry section. Return only JSON: {\"html\":\"...\"}.",
      "Speed mode: compact output. No explanations. No markdown.",
      `Required root: <section id="${sectionId}" class="ai-section contact-inquiry-section">`,
      "First child inside the section must be one scoped <style>. Every selector must start with #contact-us.",
      repairReason ? `Previous output failed validation: ${repairReason}` : "",
      userInstruction ? `User directional instruction: ${userInstruction}` : "",
      variantContract,
      paletteContract,
      styleExecutionContract,
      styleExecutionContractV2,
      gradientDisciplineContract,
      "Non-negotiable conversion contract: this section must contain a real visible <form> inquiry panel. Do not replace it with cards, checklist, email links, or CTA-only content.",
      "Fixed desktop layout: left trust/CTA column, right white inquiry form panel. Mobile layout: stack left content first, form second.",
      "Left column must include: START YOUR PROJECT eyebrow, one strong heading, one concise paragraph, phone/email/location channels when available, and a short RFQ/response promise checklist.",
      "Form panel must include heading exactly Request a Free Proposal and a short subtitle.",
      "Form fields required: Your name* text input, Country text input, Email* email input, Product / project type text input, Target capacity / quantity text input, Project details textarea.",
      "Submit button text exactly SEND INQUIRY. Use #icon-send on the button when useful. Use #icon-check, #icon-phone, #icon-mail, #icon-location for support details.",
      "Style rule: follow Brief JSON style_profile for mood, density, geometry, background treatment, CTA style, and palette. The form structure is fixed, but colors, surfaces, borders, spacing, and proof-strip treatment may adapt to the style.",
      "CSS quality: 32-72 declarations, include @media(max-width:980px) and @media(max-width:640px), use clamp(), grid-template-columns, minmax(), or flex-wrap, and avoid fixed widths over 520px.",
      "Preview ratio contract: keep heading, key contact methods, and the top of the form visible in a 16:9 preview. Avoid oversized decorative graphics and avoid pushing the form below the fold on desktop.",
      "Links/forms: form action may be #contact-us and method post. No script, no external links, no CRM/login/logout/app links.",
      "Copy: English, buyer-facing, concrete, 90-170 words outside field labels. Use real company/category/contact clues from the JSON.",
      "Brief JSON: " + JSON.stringify(contactBrief)
    ].filter(Boolean).join("\n");
  }
  return [
    "Generate one premium B2B industrial website section. Return only JSON: {\"html\":\"...\"}.",
    `Section: ${sectionKey} / ${sectionLabel}`,
    `Required section id: ${sectionId}`,
    `Plan: ${blueprint[sectionKey] || ""}`,
    "Section-specific layout strategy JSON: " + JSON.stringify(layoutStrategy),
    userInstruction ? `User directional instruction: ${userInstruction}` : "",
    repairReason ? `Previous output failed validation: ${repairReason}` : "",
    variantContract,
    paletteContract,
    styleExecutionContract,
    styleExecutionContractV2,
    gradientDisciplineContract,
    "Root: one fragment only. No doctype/html/head/body/script/on* handlers/CRM/login/logout/app links.",
    "Fixed framework: the page shell already provides topbar/header/footer, inline SVG sprite, .container/.ai-wrap, .ai-section, .ai-section-head, .ai-grid, .ai-card, .ai-btn, and responsive spacing. Keep those contracts but vary the section's visual language through scoped CSS.",
    "Style preference contract: treat the form style_requirements and Design system styleProfile as first-class instructions. Use its palette, mood, density, geometry, background treatment, CTA style, custom notes, keywords, and avoid list. Do not force the old navy/red industrial look unless the styleProfile actually asks for it.",
    "Use the framework as a compatibility layer, not as a visual template. Reuse icons with <svg aria-hidden=\"true\"><use href=\"#icon-arrow-right\"></use></svg>, #icon-cube, #icon-globe, #icon-check, or #icon-send.",
    `For business sections use exactly <section id="${sectionId}" class="ai-section ...">. Put one compact <style> as the first child inside that section.`,
    "CSS quality gate: include 24-64 CSS declarations, one @media rule for <=760px, and at least one of clamp(), minmax(), auto-fit, grid-template-columns, or flex-wrap.",
    `CSS scope gate: every selector must start with #${sectionId}. Do not style body/html/:root/global .container/header/footer.`,
    "Preview ratio contract: the primary editor preview is a fixed 16:9 iframe. Compose the first visible screen for a 16:9 canvas, keep key headings/CTAs inside the safe central area, avoid content that depends on extra vertical height, and prevent large decorative elements from pushing text off-canvas.",
    "Responsive contract: mobile-first. Use an inner wrapper with width:min(1440px,calc(100vw - clamp(32px,6vw,120px))) and margin:auto. Avoid fixed pixel widths over 420px, nowrap rows, or 4+ equal columns on wide screens. At 1200px+ add whitespace, line-length caps, and balanced asymmetry.",
    "Layout contract: obey the section-specific layout strategy above. Each section must use its own composition family and should not look interchangeable with Hero, Products, Applications, About, Blog, Contact, or custom pages. Do not use the common two-column split layout where text sits on the left and an image/card block sits on the right. Prefer a vertical homepage rhythm like the reference site: eyebrow/title/intro first, then a full-width visual/proof band, then stacked content groups. Product lists, specification cards, metrics, and content grids may use multi-column grids, but the whole section should read top-to-bottom.",
    `Local class naming: include the strategy family as a scoped class or class prefix inside #${sectionId}, for example ${sectionId}-${layoutStrategy.family.replace(/_/g, "-")}.`,
    "WordPress block contract: this section will become one reusable WP block/template part. Keep markup semantic, shallow, self-contained, and easy to convert to block attributes. Prefix local classes with the section key while keeping shared classes such as ai-section/ai-wrap/ai-card/ai-btn.",
    `Visual: follow this style profile summary: ${styleProfile.summary}. Keep all sections globally consistent through the same palette and typography scale, but each section must use a different composition family and surface treatment.`,
    styleProfile.avoid.length ? `Avoid from style profile: ${styleProfile.avoid.join("; ")}.` : "",
    "Wide-screen fit: at 1440-1920px avoid crowded equal columns. Use max-width text blocks, minmax grids, asymmetry, row gaps, and internal spacing so elements breathe instead of squeezing together.",
    "Copy: English, concrete, buyer-facing, no filler. 120-220 words max. Use real product/category clues from JSON.",
    userInstruction ? "Instruction priority: follow the user directional instruction when it does not violate safety, scoped CSS, responsive, fixed route, or WordPress block constraints." : "",
    "Design system JSON: " + JSON.stringify(designSystem),
    "Company form JSON: " + JSON.stringify(schema)
  ].filter(Boolean).join("\n");
}

function aiSiteGenerationFailure(error: unknown) {
  const raw = error instanceof Error ? error.message : "AI section generation failed";
  const timeout = /abort|timed out|timeout/i.test(raw);
  const validation = /HTML|JSON|fragment|empty|CRM/i.test(raw);
  return {
    status: timeout ? 504 : validation ? 422 : 502,
    message: timeout
      ? "AI生成超时：模型在100秒内没有完成输出，请稍后重试或缩短该区块要求。"
      : validation
        ? `AI输出格式异常：${raw}`
        : `AI生成失败：${raw}`
  };
}

async function generateAiSiteSectionHtml(project: AiSiteBuilderProject, sectionKey: AiSiteSectionKey, user: SessionUser, userInstruction = "") {
  if (aiSiteLockedSections.has(sectionKey)) return defaultAiSectionHtml(sectionKey, project, true);
  if (process.env.NODE_ENV === "test") return defaultAiSectionHtml(sectionKey, project, true);
  const settings = getStore().aiSiteBuilderSettings.find((item) => item.ownerId === user.id);
  if (!aiSiteModelReady(settings)) throw new Error("AI site builder model settings are not ready. Please save and test the API settings first.");
  await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
  const config = aiSiteSettingsToModelConfig(settings!);
  const effectiveInstruction = sectionKey === "hero" && !userInstruction.trim()
    ? "Refresh the Hero according to the current project theme colors. Use the current palette visibly in the overlay, badge, CTA, arrow controls, and micro accents while keeping the 72vh photo hero contract."
    : userInstruction;
  const generatedContent = await callAiModel(config, buildAiSiteSectionPrompt(project, sectionKey, "", effectiveInstruction), 9000);
  try {
    const html = aiSiteHtmlFromModelOutput(generatedContent, sectionKey);
    validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
    return html;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Generated HTML failed validation";
    const repaired = await callAiModel(config, buildAiSiteSectionPrompt(project, sectionKey, reason, effectiveInstruction), 9000);
    const html = aiSiteHtmlFromModelOutput(repaired, sectionKey);
    validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
    return html;
  }
  if (!aiSiteModelReady(settings)) throw new Error("请先在 AI建站 中完成接口设置与大模型检查");
  const schema = normalizeAiSiteSchemaData(project.schemaData);
  await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
  const blueprint = cleanAiSiteBlueprint(project);
  const prompt = [
    "你是跨境 B2B 工业独立站区块生成 Agent。",
    "只输出一个可被 JSON.parse 解析的 JSON 对象，格式：{\"html\":\"...\"}。",
    "html 字段必须是单个 HTML 片段，禁止 <!doctype>、<html>、<head>、<body>、<script>、内联事件、CRM 系统内容。",
    `当前区块 key：${sectionKey}`,
    `当前区块名称：${aiSiteSectionLabel(sectionKey)}`,
    `区块蓝图：${blueprint[sectionKey] || ""}`,
    "固定 CSS 类可使用：container, eyebrow, hero, grid, card, primary-btn, ghost-btn, placeholder。",
    "要求：英文站点文案，面向跨境 B2B 工业采购商；内容具体、可信、可转化；不要写中文解释。",
    `企业表单 JSON：${JSON.stringify(schema)}`
  ].join("\n");
  void prompt;
  const generationPrompt = [
    "Generate one premium B2B industrial website section. Return only JSON: {\"html\":\"...\"}.",
    `Section: ${sectionKey} / ${aiSiteSectionLabel(sectionKey)}`,
    `Plan: ${blueprint[sectionKey] || ""}`,
    "Root: one fragment only. No doctype/html/head/body/script/on* handlers/CRM/login/logout/app links.",
    "For business sections use <section id=\"kebab-section-key\">. Put one compact <style> as the first child.",
    "CSS: scoped selectors only, e.g. #products .metric. Never style html/body/:root/global tags/header/footer. Keep CSS punchy: 36-64 declarations, no reset, no giant framework.",
    "Responsive contract: mobile-first. Every section needs an inner wrapper like #products .products-wrap with width:min(1440px,calc(100vw - clamp(32px,6vw,120px))) and margin:auto. Use clamp() for section padding, gaps, and headings. Use grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr)) or explicit 2-column grids that collapse at 760px. Do not use fixed pixel widths over 420px, nowrap rows, or 4+ equal columns on wide screens. At 1200px+ add whitespace, line-length caps, and balanced asymmetry instead of squeezing everything together.",
    "WordPress block contract: this section will become one reusable WP block/template part. Keep markup semantic, shallow, self-contained, and easy to convert to block attributes. Avoid relying on sibling sections or global .container behavior. Prefix local classes with the section key and avoid duplicate generic names.",
    "Visual: bold industrial editorial, asymmetric but balanced layout, high contrast, technical pattern/detail, strong type hierarchy, proof metrics/specs/CTA. Avoid plain three-card grids unless transformed.",
    "Copy: English, concrete, buyer-facing, no filler. 120-220 words max. Use real product/category clues from JSON.",
    "Export note: this fragment and its scoped <style> will be merged with other sections, so avoid duplicate global names.",
    `Company form JSON: ${JSON.stringify(schema)}`
  ].join("\n");
  const content = await callAiModel(aiSiteSettingsToModelConfig(settings!), generationPrompt, 9000);
  return aiSiteHtmlFromModelOutput(content, sectionKey);
}

function maskedKey(value: string) {
  return value ? `****${value.slice(-4)}` : "";
}

function publicAiSiteBuilderSettings(user: SessionUser) {
  const existing = getStore().aiSiteBuilderSettings.find((item) => item.ownerId === user.id);
  const synced = existing || (getAiConfig(user) ? aiSiteSettingFromAiConfig(getAiConfig(user)!, user) : null);
  const preset = aiSiteModelPresets[0];
  const settings = synced || {
    ownerId: user.id,
    teamId: user.teamId,
    provider: preset.provider,
    model: preset.model,
    baseUrl: preset.baseUrl,
    apiKey: "",
    enabled: false,
    lastTestStatus: "untested" as const,
    lastTestMessage: "未检查",
    updatedAt: new Date().toISOString()
  };
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    enabled: settings.enabled,
    hasApiKey: Boolean(settings.apiKey),
    maskedApiKey: maskedKey(settings.apiKey),
    lastTestStatus: settings.lastTestStatus,
    lastTestMessage: settings.lastTestMessage,
    updatedAt: settings.updatedAt
  };
}

app.get("/api/ai-site-builder/capabilities", requireAuth, (req, res) => {
  res.json({
    status: "reserved",
    message: "AI建站接口已预留，当前仅创建草稿，不执行真实生成或发布。",
    scope: req.user?.role === "sales" ? "personal" : req.user?.role === "manager" ? "team" : "global",
    capabilities: ["需求结构化", "页面规划", "内容生成预留", "预览发布预留"],
    defaultPages: ["首页", "产品中心", "解决方案", "成功案例", "联系我们"],
    phases: [
      { key: "brief", label: "需求收集" },
      { key: "plan", label: "站点规划" },
      { key: "generate", label: "AI生成预留" },
      { key: "publish", label: "预览发布预留" }
    ]
  });
});

app.get("/api/ai-site-builder/models", requireAuth, (_req, res) => {
  res.json({ providers: aiSiteModelPresets });
});

app.get("/api/ai-site-builder/settings", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  res.json({ settings: publicAiSiteBuilderSettings(req.user!) });
}));

app.post("/api/ai-site-builder/settings", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const schema = z.object({
    provider: z.string().min(1).max(60).default("openai"),
    model: z.string().max(120).default(""),
    baseUrl: z.string().max(240).default(""),
    apiKey: z.string().max(500).optional().default(""),
    enabled: z.boolean().default(false)
  });
  const body = schema.parse(req.body);
  const store = getStore();
  const preset = aiSiteModelPresets.find((item) => item.provider === body.provider);
  const index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === req.user!.id);
  const previous = index >= 0 ? store.aiSiteBuilderSettings[index] : null;
  const next = {
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    provider: body.provider,
    model: body.model || preset?.model || "",
    baseUrl: body.baseUrl || preset?.baseUrl || "",
    apiKey: body.apiKey && !body.apiKey.includes("****") ? body.apiKey : previous?.apiKey || "",
    enabled: body.enabled,
    lastTestStatus: previous?.lastTestStatus || "untested" as const,
    lastTestMessage: previous?.lastTestMessage || "未检查",
    updatedAt: new Date().toISOString()
  };
  if (index >= 0) store.aiSiteBuilderSettings[index] = next;
  else store.aiSiteBuilderSettings.push(next);
  upsertAiConfigFromAiSiteSetting(next);
  await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
  await store.persist();
  res.json({ settings: publicAiSiteBuilderSettings(req.user!) });
}));

app.post("/api/ai-site-builder/settings/test", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const schema = z.object({
    provider: z.string().min(1).max(60).optional(),
    model: z.string().max(120).optional(),
    baseUrl: z.string().max(240).optional(),
    apiKey: z.string().max(500).optional(),
    enabled: z.boolean().optional()
  });
  const body = schema.parse(req.body || {});
  const store = getStore();
  let index = store.aiSiteBuilderSettings.findIndex((item) => item.ownerId === req.user!.id);
  if (index < 0) {
    const preset = aiSiteModelPresets.find((item) => item.provider === body.provider) || aiSiteModelPresets[0];
    store.aiSiteBuilderSettings.push({
      ownerId: req.user!.id,
      teamId: req.user!.teamId,
      provider: body.provider || preset.provider,
      model: body.model || preset.model,
      baseUrl: body.baseUrl || preset.baseUrl,
      apiKey: body.apiKey || "",
      enabled: body.enabled ?? false,
      lastTestStatus: "untested",
      lastTestMessage: "未检查",
      updatedAt: new Date().toISOString()
    });
    index = store.aiSiteBuilderSettings.length - 1;
  }
  const settings = store.aiSiteBuilderSettings[index];
  const preset = aiSiteModelPresets.find((item) => item.provider === (body.provider || settings.provider));
  settings.provider = body.provider || settings.provider;
  settings.model = body.model || settings.model || preset?.model || "";
  settings.baseUrl = body.baseUrl || settings.baseUrl || preset?.baseUrl || "";
  settings.apiKey = body.apiKey && !body.apiKey.includes("****") ? body.apiKey : settings.apiKey;
  settings.enabled = body.enabled ?? settings.enabled;
  const result = await testAiSiteBuilderModel(settings);
  settings.lastTestStatus = result.ok ? "passed" : "failed";
  settings.lastTestMessage = result.message;
  settings.updatedAt = new Date().toISOString();
  const mirrored = upsertAiConfigFromAiSiteSetting(settings);
  mirrored.lastTestAt = new Date().toISOString();
  mirrored.lastTestStatus = settings.lastTestStatus;
  mirrored.lastTestMessage = settings.lastTestMessage;
  mirrored.updatedAt = settings.updatedAt;
  await persistAiSiteSettingsLocal(store.aiSiteBuilderSettings);
  await store.persist();
  res.json({ ok: result.ok, message: settings.lastTestMessage, settings: publicAiSiteBuilderSettings(req.user!) });
}));

app.get("/api/ai-site-builder/projects", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  res.json({
    projects: getStore().aiSiteBuilderProjects.filter((project) => canSeeAiSiteProject(req.user!, project)),
    message: "项目列表接口已预留；接入持久化后将按账号数据范围返回建站项目。"
  });
}));

app.get("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  res.json({ project });
}));

app.patch("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const schema = z.object({
    taskName: z.string().max(120).optional(),
    siteName: z.string().max(120).optional(),
    industry: z.string().max(120).optional(),
    goal: z.enum(["lead-generation", "brand", "catalog", "support"]).optional(),
    tone: z.string().max(80).optional(),
    pages: z.array(z.string().min(1).max(40)).max(12).optional(),
    schemaData: z.unknown().optional(),
    agentPayload: z.unknown().optional()
  });
  const body = schema.parse(req.body || {});
  const schemaData = body.schemaData === undefined ? normalizeAiSiteSchemaData(project.schemaData) : normalizeAiSiteSchemaData(body.schemaData);
  const pages = body.pages?.length ? body.pages : project.pages?.length ? project.pages : ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
  const company = schemaData.company_profile;
  const taxonomy = schemaData.business_taxonomy;
  project.schemaData = schemaData;
  project.pages = pages;
  project.taskName = body.taskName || project.taskName || `${company.legal_name || company.wordmark || "未命名网站"} 建站任务`;
  project.siteName = body.siteName || company.legal_name || company.wordmark || project.siteName || "未命名网站";
  project.industry = body.industry || taxonomy.product_categories[0] || project.industry || "未指定行业";
  project.goal = body.goal || project.goal || "lead-generation";
  project.tone = body.tone || schemaData.style_requirements.preset || project.tone || "industrial-professional";
  project.agentPayload = normalizeAgentPayload(body.agentPayload, schemaData, pages);
  await ensureAiSiteSandbox(project);
  await writeFile(path.join(aiProjectDir(project.id), "blueprint.json"), JSON.stringify(cleanAiSiteBlueprint(project), null, 2), "utf8");
  await getStore().persist();
  res.json({ project });
}));

app.delete("/api/ai-site-builder/projects/:id", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const store = getStore();
  const index = store.aiSiteBuilderProjects.findIndex((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (index < 0) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const [project] = store.aiSiteBuilderProjects.splice(index, 1);
  await rm(aiProjectDir(project.id), { recursive: true, force: true });
  await store.persist();
  res.json({ ok: true, id: project.id });
}));

app.get("/api/ai-site-builder/projects/:id/editor", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  await ensureAiSiteSandbox(project);
  const order = await readAiSiteOrder(project);
  const customPages = await readAiSiteCustomPages(project);
  const blueprintRaw = await readFile(path.join(aiProjectDir(project.id), "blueprint.json"), "utf8").catch(() => "{}");
  const blueprint = JSON.parse(blueprintRaw || "{}") as Record<string, string>;
  const sections = await Promise.all(order.map(async (key) => {
    const exists = await fileExists(aiSectionFile(project.id, key));
    const html = exists ? await readFile(aiSectionFile(project.id, key), "utf8").catch(() => "") : "";
    let generated = exists;
    if (exists && !aiSiteLockedSections.has(key)) {
      try {
        validateGeneratedAiSiteSectionHtml(html, key, project);
      } catch {
        generated = false;
      }
    }
    return {
      key,
      label: aiSiteSectionLabel(key, customPages),
      locked: aiSiteLockedSections.has(key),
      generated,
      blueprint: aiSiteSectionBlueprint(key, blueprint, customPages)
    };
  }));
  const wpMetadata = await readAiSiteWpMetadata(project, order, customPages);
  const sectionStatus = new Map(sections.map((section) => [section.key, section.locked ? "locked" : section.generated ? "html_ready" : "blueprint"] as const));
  wpMetadata.sections = wpMetadata.sections.map((section) => ({
    ...section,
    status: sectionStatus.get(section.section_key) || section.status
  }));
  wpMetadata.updated_at = new Date().toISOString();
  await writeAiSiteWpMetadata(wpMetadata);
  const wpSectionMap = new Map(wpMetadata.sections.map((section) => [section.section_key, section]));
  res.json({ project, order, sections: sections.map((section) => ({ ...section, wp: wpSectionMap.get(section.key) })), blueprint, wpMetadata });
}));

app.patch("/api/ai-site-builder/projects/:id/editor/order", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const schema = z.object({ order: z.array(z.string()).default([]) });
  const body = schema.parse(req.body || {});
  const order = await writeAiSiteOrder(project, body.order);
  const customPages = await readAiSiteCustomPages(project);
  await readAiSiteWpMetadata(project, order, customPages);
  res.json({ order });
}));

app.post("/api/ai-site-builder/projects/:id/editor/pages", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const schema = z.object({ title: z.string().max(80).optional().default("") });
  const body = schema.parse(req.body || {});
  await ensureAiSiteSandbox(project);
  const customPages = await readAiSiteCustomPages(project);
  const label = cleanAiSiteCustomPageLabel(body.title, `New Page ${customPages.length + 1}`);
  let key = `custom_${Date.now().toString(36)}`;
  while (customPages.some((item) => item.key === key) || (await fileExists(aiSectionFile(project.id, key)))) {
    key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  const nextCustomPages = [...customPages, { key, label, createdAt: new Date().toISOString() }];
  await writeAiSiteCustomPages(project, nextCustomPages);

  const blueprintPath = path.join(aiProjectDir(project.id), "blueprint.json");
  const blueprint = await readJsonFile<Record<string, string>>(blueprintPath, cleanAiSiteBlueprint(project));
  blueprint[key] = `Custom page: ${label}. Start from a simple editable page section, then let the agent rewrite it with page-specific B2B industrial content when needed.`;
  delete blueprint.project_cases;
  await writeFile(blueprintPath, JSON.stringify(blueprint, null, 2), "utf8");

  const currentOrder = await readAiSiteOrder(project);
  const insertAt = Math.max(1, currentOrder.length - 1);
  const nextOrder = await writeAiSiteOrder(project, [...currentOrder.slice(0, insertAt), key, ...currentOrder.slice(insertAt)]);
  await writeFile(aiSectionFile(project.id, key), defaultAiSectionHtml(key, project, false, nextCustomPages), "utf8");
  const wpMetadata = await readAiSiteWpMetadata(project, nextOrder, nextCustomPages);
  res.json({ key, label, order: nextOrder, wpMetadata, message: `${label} page added` });
}));

app.get("/api/ai-site-builder/projects/:id/wp-rebuild", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "AI site project was not found or is not accessible." });
    return;
  }
  const result = await inspectAiSiteWpRebuild(project);
  res.json(result);
}));

app.post("/api/ai-site-builder/projects/:id/wp-rebuild/check", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "AI site project was not found or is not accessible." });
    return;
  }
  const result = await inspectAiSiteWpRebuild(project);
  res.json(result);
}));

app.post("/api/ai-site-builder/projects/:id/wp-rebuild/export", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "AI site project was not found or is not accessible." });
    return;
  }
  const result = await exportAiSiteWpRebuildPackage(project);
  res.json(result);
}));

app.post("/api/ai-site-builder/projects/:id/wp-rebuild/install", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "AI site project was not found or is not accessible." });
    return;
  }
  const schema = z.object({
    wordpressRoot: z.string().min(1).max(500),
    themeSlug: z.string().max(80).optional(),
    overwrite: z.boolean().optional().default(false)
  });
  const body = schema.parse(req.body || {});
  const result = await installAiSiteWpRebuildPackage(project, body.wordpressRoot, body.themeSlug, body.overwrite);
  res.json(result);
}));

app.get("/api/ai-site-builder/projects/:id/sections/:sectionKey", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  const sectionKey = req.params.sectionKey;
  if (!project || !isAiSiteSectionKey(sectionKey)) {
    res.status(404).json({ message: "区块不存在或无权访问" });
    return;
  }
  await ensureAiSiteSandbox(project);
  const customPages = await readAiSiteCustomPages(project);
  const file = aiSectionFile(project.id, sectionKey);
  const designSystem = aiSiteDesignSystem(project);
  if (!(await fileExists(file)) && !aiSiteLockedSections.has(sectionKey)) {
    res.json({ sectionKey, html: defaultAiSectionHtml(sectionKey, project, false, customPages), generated: false, designSystem });
    return;
  }
  const html = await readFile(file, "utf8");
  let generated = true;
  if (!aiSiteLockedSections.has(sectionKey)) {
    try {
      validateGeneratedAiSiteSectionHtml(html, sectionKey, project);
    } catch {
      generated = false;
    }
  }
  res.json({ sectionKey, html, generated, designSystem });
}));

app.put("/api/ai-site-builder/projects/:id/sections/:sectionKey", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  const sectionKey = req.params.sectionKey;
  if (!project || !isAiSiteSectionKey(sectionKey)) {
    res.status(404).json({ message: "区块不存在或无权访问" });
    return;
  }
  const schema = z.object({ html: z.string().max(200000).default("") });
  const body = schema.parse(req.body || {});
  await ensureAiSiteSandbox(project);
  await writeFile(aiSectionFile(project.id, sectionKey), body.html || defaultAiSectionHtml(sectionKey, project, true), "utf8");
  let generated = true;
  if (!aiSiteLockedSections.has(sectionKey)) {
    try {
      validateGeneratedAiSiteSectionHtml(body.html || "", sectionKey, project);
    } catch {
      generated = false;
    }
  }
  res.json({ sectionKey, html: body.html, generated });
}));

app.post("/api/ai-site-builder/projects/:id/sections/:sectionKey/generate", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  const sectionKey = req.params.sectionKey;
  if (!project || !isAiSiteSectionKey(sectionKey)) {
    res.status(404).json({ message: "区块不存在或无权访问" });
    return;
  }
  const schema = z.object({ instruction: z.string().max(1200).optional().default("") });
  const body = schema.parse(req.body || {});
  await ensureAiSiteSandbox(project);
  if (aiSiteLockedSections.has(sectionKey)) {
    const palette = refreshAiSiteProjectThemePalette(project);
    const headerHtml = defaultAiSectionHtml("header", project, true);
    const footerHtml = defaultAiSectionHtml("footer", project, true);
    await writeFile(aiSectionFile(project.id, "header"), headerHtml, "utf8");
    await writeFile(aiSectionFile(project.id, "footer"), footerHtml, "utf8");
    await writeFile(aiProjectMetaFile(project.id), JSON.stringify(project, null, 2), "utf8");
    await writeFile(path.join(aiProjectDir(project.id), "form.json"), JSON.stringify(project.schemaData || {}, null, 2), "utf8");
    await writeFile(aiSiteDesignSystemFile(project.id), JSON.stringify(aiSiteDesignSystem(project), null, 2), "utf8");
    await getStore().persist();
    const html = sectionKey === "header" ? headerHtml : footerHtml;
    res.json({
      sectionKey,
      html,
      generated: true,
      changed: true,
      palette,
      message: `${aiSiteSectionLabel(sectionKey)} theme colors refreshed`
    });
    return;
  }
  try {
    const html = await generateAiSiteSectionHtml(project, sectionKey, req.user!, body.instruction.trim());
    await writeFile(aiSectionFile(project.id, sectionKey), html, "utf8");
  res.json({ sectionKey, html, generated: true, message: `${aiSiteSectionLabel(sectionKey)} generated and written to local HTML fragment` });
  } catch (error) {
    const failure = aiSiteGenerationFailure(error);
    res.status(failure.status).json({
      ok: false,
      sectionKey,
      generated: false,
      message: failure.message,
      progress: [`${aiSiteSectionLabel(sectionKey)} generation failed`, failure.message]
    });
  }
}));

app.post("/api/ai-site-builder/projects/:id/sections/generate-batch", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const schema = z.object({ order: z.array(z.string()).default([]) });
  const body = schema.parse(req.body || {});
  await ensureAiSiteSandbox(project);
  const savedOrder = body.order.length ? await writeAiSiteOrder(project, body.order) : await readAiSiteOrder(project);
  const targets = savedOrder.filter((key) => !aiSiteLockedSections.has(key));
  const results: Array<{ sectionKey: AiSiteSectionKey; label: string; ok: boolean; message: string }> = [];
  for (const sectionKey of targets) {
    try {
      const html = await generateAiSiteSectionHtml(project, sectionKey, req.user!);
      await writeFile(aiSectionFile(project.id, sectionKey), html, "utf8");
      results.push({ sectionKey, label: aiSiteSectionLabel(sectionKey), ok: true, message: "已生成" });
    } catch (error) {
      results.push({
        sectionKey,
        label: aiSiteSectionLabel(sectionKey),
        ok: false,
        message: error instanceof Error ? error.message : "生成失败，已保留旧片段"
      });
    }
  }
  res.json({
    ok: results.every((item) => item.ok),
    generatedCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    results,
    message: `批量生成完成：成功 ${results.filter((item) => item.ok).length} 个，失败 ${results.filter((item) => !item.ok).length} 个`
  });
}));

app.post("/api/ai-site-builder/projects/:id/export", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const project = getStore().aiSiteBuilderProjects.find((item) => item.id === req.params.id && canSeeAiSiteProject(req.user!, item));
  if (!project) {
    res.status(404).json({ message: "建站项目任务不存在或无权访问" });
    return;
  }
  const schema = z.object({ order: z.array(z.string()).default([]) });
  const body = schema.parse(req.body || {});
  const exportResult = await exportAiSiteProject(project, body.order);
  res.json({
    ok: true,
    export: exportResult,
    message: `整站已导出：${exportResult.indexPath}`
  });
}));

app.post("/api/ai-site-builder/projects", requireAuth, asyncRoute(async (req, res) => {
  await hydrateAiSiteLocalState(req.user!);
  const schema = z.object({
    taskName: z.string().max(120).optional().default("官网建站任务"),
    siteName: z.string().max(120).optional().default(""),
    industry: z.string().max(120).optional().default(""),
    goal: z.enum(["lead-generation", "brand", "catalog", "support"]).default("lead-generation"),
    tone: z.string().max(80).default("professional"),
    pages: z.array(z.string().min(1).max(40)).max(12).default([]),
    brief: z.string().max(1200).default(""),
    schemaData: z.unknown().optional(),
    agentPayload: z.unknown().optional()
  });
  const body = schema.parse(req.body);
  const schemaData = normalizeAiSiteSchemaData(body.schemaData);
  const pages = body.pages.length ? body.pages : ["首页", "产品中心", "解决方案", "成功案例", "联系我们"];
  const agentPayload = normalizeAgentPayload(body.agentPayload, schemaData, pages);
  const company = schemaData.company_profile;
  const taxonomy = schemaData.business_taxonomy;
  const project: AiSiteBuilderProject = {
    id: `site_${Date.now()}`,
    taskName: body.taskName || "官网建站任务",
    siteName: body.siteName || company.legal_name || company.wordmark || "未命名网站",
    industry: body.industry || taxonomy.product_categories[0] || "未指定行业",
    goal: body.goal,
    tone: body.tone,
    pages,
    schemaData,
    agentPayload,
    status: "draft_reserved",
    ownerId: req.user!.id,
    teamId: req.user!.teamId,
    createdAt: new Date().toISOString()
  };
  const store = getStore();
  store.aiSiteBuilderProjects.unshift(project);
  await ensureAiSiteSandbox(project);
  await store.persist();
  res.status(201).json({
    project,
    nextActions: [
      "确认站点信息架构和页面范围",
      "接入AI内容生成服务",
      "接入主题/模板生成器",
      "接入预览、发布和回滚流程"
    ]
  });
}));

app.get("/api/dashboard/summary", requireAuth, (req, res) => {
  const store = getStore();
  const archived = archiveExpiredTodos(store.todos, new Date());
  if (archived.length) void store.persist();
  const { customers, todos, deals, reminders, knowledgeAssets, exams, wecomMessages } = store;
  const scopedCustomers = customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  const scopedTodos = todos.filter((todo) => canSeePersonalData(req.user!, todo.ownerId));
  const scopedDeals = deals.filter((deal) => canSeeOwner(req.user!, deal.ownerId, deal.teamId) && !deal.archivedAt);
  const scopedReminders = reminders.filter((reminder) => canSeeOwner(req.user!, reminder.ownerId, reminder.teamId));
  const scopedKnowledge = req.user?.role === "sales" ? knowledgeAssets.filter((asset) => asset.ownerId === req.user?.id) : knowledgeAssets;
  const scopedMessages = wecomMessages.filter((message) => canSeeOwner(req.user!, message.ownerId, message.teamId));
  const activeTodos = scopedTodos.filter((todo) => !isHistoricalTodo(todo));
  const pendingTodos = activeTodos.filter((todo) => !todo.done);
  const overdueTodos = pendingTodos.filter((todo) => todo.priority === "high");
  const historyTodos = scopedTodos.filter(isHistoricalTodo);
  const riskCustomers = scopedCustomers.filter((customer) => customer.nextReminder.includes("逾期") || customer.health < 60);
  const riskAmount = riskCustomers.reduce((sum, customer) => sum + customer.amount, 0);
  const forecastAmount = scopedDeals.reduce((sum, deal) => sum + deal.amount, 0) || scopedCustomers.reduce((sum, customer) => sum + customer.amount, 0);
  const wecomBound = scopedCustomers.filter((customer) => customer.wecomBound).length;
  const pendingKnowledge = scopedKnowledge.filter((asset) => asset.status !== "published");
  const publishedExams = exams.filter((exam) => exam.status === "published");
  const averagePassRate = publishedExams.length ? Math.round(publishedExams.reduce((sum, exam) => sum + exam.passRate, 0) / publishedExams.length) : 0;
  const pendingMessages = scopedMessages.filter((message) => message.status === "pending");
  const readyDeals = scopedDeals.filter((deal) => ["已报价", "样品", "谈判"].includes(deal.stage));
  const topTodos = [...pendingTodos].sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0) || priorityWeight(b.priority) - priorityWeight(a.priority)).slice(0, 3);
  const priorityTasks = buildPriorityTasks(scopedDeals, scopedCustomers, pendingTodos);
  const topDeals = priorityTasks.map((task) => task.deal);
  const pipelineHealth = buildPipelineHealth(scopedDeals, scopedCustomers);
  const typeRows = ["customer", "knowledge", "exam", "ocr", "other"].map((type) => {
    const items = pendingTodos.filter((todo) => todo.type === type);
    return {
      type,
      label: todoTypeLabel(type),
      count: items.length,
      risk: items.some((todo) => todo.priority === "high") ? "高" : items.some((todo) => todo.priority === "medium") ? "中" : "普通"
    };
  }).filter((row) => row.count > 0);
  const weekLoad = ["一", "二", "三", "四", "五", "六", "日"].map((day, index) => ({
    day,
    count: pendingTodos.filter((_, todoIndex) => todoIndex % 7 === index).length + (index < Math.min(pendingTodos.length, 7) ? 1 : 0)
  }));
  const topRiskNames = riskCustomers.slice(0, 3).map((customer) => customer.company).join("、") || topDeals.slice(0, 2).map((deal) => deal.title).join("、") || "暂无高风险客户";
  res.json({
    scope: req.user?.role === "sales" ? "仅本人业务与本人待办" : req.user?.role === "manager" ? "团队业务数据，本人待办" : "全局业务数据，本人待办",
    updatedAt: new Date().toISOString(),
    briefing: {
      title: pendingTodos.length
        ? `今天最该处理的是 ${pendingTodos.length} 个待办，其中 ${overdueTodos.length} 个属于高优先级。`
        : "今天暂无未完成待办，可以复盘客户资料和销售知识库。",
      description: riskCustomers.length
        ? `系统根据客户金额、健康度、阶段和提醒状态计算，建议优先处理 ${topRiskNames}。`
        : `当前客户风险较低，建议推进 ${topDeals[0]?.title || "高金额商机"} 并保持企微记录归档。`,
      basis: `依据：${pendingTodos.length} 个未完成待办、${riskCustomers.length} 个风险客户、${readyDeals.length} 个可推进商机、${pendingMessages.length} 条企微待归档。`,
      action: overdueTodos.length
        ? `建议动作：先处理 ${overdueTodos.length} 个高优先级待办，再跟进金额最高的商机。`
        : `建议动作：按今日节奏完成待办，并把可成交商机推进到下一阶段。`,
      impact: riskAmount
        ? `影响范围：${moneyText(riskAmount)} 风险金额，处理后可降低逾期和报价流失。`
        : `影响范围：${moneyText(readyDeals.reduce((sum, deal) => sum + deal.amount, 0))} 可推进金额，适合用于晨会安排。`,
      riskAmount,
      riskLabel: req.user?.role === "sales" ? "本人名下风险" : req.user?.role === "manager" ? "团队风险金额" : "全局风险金额",
      closableDeals: readyDeals.length,
      closableAmount: readyDeals.reduce((sum, deal) => sum + deal.amount, 0),
      unreadWecom: pendingMessages.length
    },
    metrics: {
      customers: scopedCustomers.length,
      todos: pendingTodos.length,
      overdueTodos: overdueTodos.length,
      forecastAmount,
      wecomBoundRate: scopedCustomers.length ? Math.round((wecomBound / scopedCustomers.length) * 100) : 0,
      pendingKnowledge: pendingKnowledge.length,
      examPassRate: averagePassRate,
      unfinishedExams: exams.filter((exam) => exam.status !== "published").length,
      customerCompleteness: scopedCustomers.length ? Math.round(scopedCustomers.reduce((sum, customer) => sum + (customer.contact ? 25 : 0) + (customer.country ? 25 : 0) + (customer.stage ? 25 : 0) + (customer.nextReminder ? 25 : 0), 0) / scopedCustomers.length) : 0
    },
    schedule: topTodos.map((todo) => ({
      time: todo.dueAt || "待定",
      title: todo.title,
      subtitle: todo.related || todoTypeLabel(todo.type),
      tone: todo.priority === "high" ? "red" : todo.priority === "medium" ? "amber" : "green"
    })),
    quality: {
      followHealth: scopedCustomers.length ? Math.round(scopedCustomers.reduce((sum, customer) => sum + customer.health, 0) / scopedCustomers.length) : 0,
      overdueRate: pendingTodos.length ? Math.round((overdueTodos.length / pendingTodos.length) * 100) : 0,
      avgResponseHours: Number((Math.max(1, pendingMessages.length + scopedReminders.filter((reminder) => reminder.status === "pending").length) * 1.6).toFixed(1))
    },
    pipelineHealth,
    todoInsights: {
      total: pendingTodos.length,
      overdue: overdueTodos.length,
      completionRate: activeTodos.length ? Math.round((activeTodos.filter((todo) => todo.done).length / activeTodos.length) * 100) : 0,
      impactAmount: pendingTodos.reduce((sum, todo) => sum + (todo.impactAmount || 0), 0),
      typeRows,
      weekLoad,
      historyCount: historyTodos.length,
      historyAmount: historyTodos.reduce((sum, todo) => sum + (todo.impactAmount || 0), 0)
    },
    priorityTasks: priorityTasks.map(({ deal, customer, score, reason, action, tone }) => ({
      id: deal.id,
      customerId: customer?.id || deal.customerId,
      title: deal.title,
      subtitle: `${customer?.country || "未知国家"} · ${deal.stage} · ${moneyText(deal.amount)} · ${deal.nextAction}`,
      score,
      reason,
      action,
      tone,
      badge: customer?.nextReminder.includes("逾期") ? "逾期" : deal.stage
    }))
  });
});

app.post("/api/dashboard/priority-tasks/batch-process", requireAuth, asyncRoute(async (req, res) => {
  const store = getStore();
  const scopedCustomers = store.customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  const scopedDeals = store.deals.filter((deal) => canSeeOwner(req.user!, deal.ownerId, deal.teamId) && !deal.archivedAt);
  const scopedTodos = store.todos.filter((todo) => canSeePersonalData(req.user!, todo.ownerId));
  const pendingTodos = scopedTodos.filter((todo) => !todo.done && !isHistoricalTodo(todo));
  const priorityTasks = buildPriorityTasks(scopedDeals, scopedCustomers, pendingTodos).slice(0, 3);
  const created: Todo[] = [];
  for (const task of priorityTasks) {
    const exists = store.todos.some((todo) => todo.ownerId === req.user!.id && !todo.done && todo.related === task.deal.title && todo.title.includes("跟进优先级"));
    if (exists) continue;
    const todo: Todo = {
      id: `t_priority_${task.deal.id}_${Date.now()}_${created.length}`,
      title: `跟进优先级：${task.action}`,
      type: "customer",
      priority: task.score >= 80 ? "high" : task.score >= 60 ? "medium" : "normal",
      dueAt: currentMinuteText(),
      ownerId: req.user!.id,
      teamId: req.user!.teamId,
      related: task.deal.title,
      done: false,
      impactAmount: task.deal.amount,
      createdAt: new Date().toISOString()
    };
    store.todos.unshift(todo);
    created.push(todo);
  }
  await store.persist();
  res.json({ created, processed: priorityTasks.length, skipped: priorityTasks.length - created.length });
}));

function isHistoricalTodo(todo: Todo) {
  return Boolean(todo.historyAt);
}

function shouldArchiveTodo(todo: Todo, now = new Date()) {
  if (todo.historyAt) return false;
  const parsed = parseDueDate(todo.dueAt, todo.createdAt);
  if (!parsed) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed < today;
}

function archiveExpiredTodos(todos: Todo[], now = new Date()) {
  const archiveTime = now.toISOString();
  const archived = todos.filter((todo) => shouldArchiveTodo(todo, now));
  archived.forEach((todo) => {
    todo.historyAt = archiveTime;
    todo.status = "pending";
    todo.pinState = "";
  });
  return archived;
}

function parseDueDate(value: string, fallbackCreatedAt?: string) {
  const text = value.trim();
  const exact = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (exact) return new Date(Number(exact[1]), Number(exact[2]) - 1, Number(exact[3]));
  const now = fallbackCreatedAt ? new Date(fallbackCreatedAt) : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (text.includes("昨天")) return new Date(today.getTime() - 86400000);
  if (text.includes("前天")) return new Date(today.getTime() - 86400000 * 2);
  if (!text) return today;
  if (text.includes("今天") || /^(\d{1,2}):(\d{2})$/.test(text)) return today;
  if (text.includes("明天")) return new Date(today.getTime() + 86400000);
  return fallbackCreatedAt ? today : null;
}

function scheduleMidnightTodoArchive() {
  const run = async () => {
    const store = getStore();
    const archived = archiveExpiredTodos(store.todos, new Date());
    if (archived.length) {
      await store.persist();
      console.log(`GoodJob CRM archived ${archived.length} todos into history`);
    }
    schedule();
  };
  const schedule = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 3);
    const delay = Math.max(1000, next.getTime() - now.getTime());
    windowlessSetTimeout(() => void run(), delay);
  };
  schedule();
}

function windowlessSetTimeout(callback: () => void, delay: number) {
  setTimeout(callback, delay);
}

function priorityWeight(priority: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function nextTodoSortOrder(todos: Todo[], ownerId: string) {
  const scoped = todos.filter((todo) => todo.ownerId === ownerId);
  return Math.min(0, ...scoped.map((todo) => typeof todo.sortOrder === "number" ? todo.sortOrder : 0)) - 1;
}

function buildPriorityTasks(deals: Deal[], customers: Customer[], todos: Todo[]) {
  const maxAmount = Math.max(...deals.map((deal) => deal.amount), 1);
  return deals
    .filter((deal) => !deal.archivedAt && deal.stage !== "成交" && deal.stage !== "丢单")
    .map((deal) => {
      const customer = customers.find((item) => item.id === deal.customerId);
      const amountScore = Math.round((deal.amount / maxAmount) * 35);
      const stageScore = stagePriorityScore(deal.stage);
      const riskScore = customer?.nextReminder.includes("逾期") ? 25 : (customer?.health ?? 100) < 60 ? 18 : 0;
      const todoScore = todos.some((todo) => todo.related.includes(customer?.company || deal.title) || todo.related.includes(deal.title)) ? 10 : 0;
      const score = Math.min(100, amountScore + stageScore + riskScore + todoScore);
      const reasons = [
        `金额权重 ${amountScore}`,
        `阶段权重 ${stageScore}`,
        riskScore ? `风险权重 ${riskScore}` : "风险权重 0",
        todoScore ? "已有待办推动" : "暂无关联待办"
      ];
      const action = nextPriorityAction(deal, customer);
      const tone = score >= 80 ? "red" : score >= 60 ? "amber" : "brand";
      return { deal, customer, score, reason: reasons.join(" · "), action, tone };
    })
    .sort((left, right) => right.score - left.score || right.deal.amount - left.deal.amount)
    .slice(0, 3);
}

function buildPipelineHealth(deals: Deal[], customers: Customer[]) {
  const stages = ["询盘", "已联系", "已报价", "样品", "谈判", "成交"];
  const activeDeals = deals.filter((deal) => !deal.archivedAt && deal.stage !== "丢单");
  const maxCount = Math.max(...stages.map((stage) => activeDeals.filter((deal) => deal.stage === stage).length), 1);
  return stages.map((stage) => {
    const stageDeals = activeDeals.filter((deal) => deal.stage === stage);
    const amount = stageDeals.reduce((sum, deal) => sum + deal.amount, 0);
    const riskCount = stageDeals.filter((deal) => {
      const customer = customers.find((item) => item.id === deal.customerId);
      return Boolean(customer?.nextReminder.includes("逾期")) || (customer?.health ?? 100) < 60;
    }).length;
    return {
      stage,
      count: stageDeals.length,
      amount,
      riskCount,
      width: stageDeals.length ? Math.max(8, Math.round((stageDeals.length / maxCount) * 100)) : 0,
      tone: riskCount ? "amber" : stage === "成交" ? "green" : "aqua"
    };
  });
}

function stagePriorityScore(stage: string) {
  const map: Record<string, number> = {
    谈判: 30,
    样品: 24,
    已报价: 20,
    已联系: 12,
    询盘: 8
  };
  return map[stage] || 6;
}

function nextPriorityAction(deal: Deal, customer?: Customer) {
  if (customer?.nextReminder.includes("逾期")) return `二次跟进 ${customer.company} 并确认 ${deal.nextAction}`;
  if ((customer?.health ?? 100) < 60) return `补齐 ${customer?.company || deal.title} 的风险资料并同步主管`;
  if (deal.stage === "谈判") return `确认 ${deal.title} 的价格、账期和成交条件`;
  if (deal.stage === "样品") return `确认 ${deal.title} 的样品反馈和复购时间`;
  if (deal.stage === "已报价") return `发送 ${deal.title} 的报价二次确认`;
  return `推进 ${deal.title} 的下一步：${deal.nextAction}`;
}

function reminderRuleTitle(ruleType = "quote_no_reply") {
  const map: Record<string, string> = {
    quote_no_reply: "报价后未回复提醒",
    sample_feedback: "样品反馈提醒",
    inactive_customer: "长期未联系提醒",
    high_value_revisit: "高价值客户复访",
    custom_due: "自定义跟进提醒"
  };
  return map[ruleType] || "自定义跟进提醒";
}

function reminderRuleText(rule: { ruleType?: string; targetStage?: string; days?: number; channel?: string; priority?: string }) {
  const days = rule.days ?? 3;
  const stage = rule.targetStage || "已报价";
  const channel = rule.channel || "企业微信";
  if (rule.ruleType === "sample_feedback") return `客户阶段为样品，${days} 天内需要反馈，通过${channel}提醒`;
  if (rule.ruleType === "inactive_customer") return `${days} 天未推进且客户仍在${stage}阶段，通过${channel}提醒`;
  if (rule.ruleType === "high_value_revisit") return `金额较高或健康度偏低客户 ${days} 天复访，通过${channel}提醒`;
  if (rule.ruleType === "custom_due") return `${stage}阶段客户按指定时间提醒，通过${channel}提醒`;
  return `${stage}阶段客户报价后 ${days} 天未回复，通过${channel}提醒`;
}

function matchReminderRule(user: SessionUser, rule: { ruleType?: string; targetStage?: string; days?: number; priority?: string }) {
  const store = getStore();
  const scopedCustomers = store.customers.filter((customer) => canSeeOwner(user, customer.ownerId, customer.teamId));
  const stage = rule.targetStage || "已报价";
  const ruleType = rule.ruleType || "quote_no_reply";
  if (ruleType === "sample_feedback") return scopedCustomers.filter((customer) => customer.stage === "样品");
  if (ruleType === "inactive_customer") return scopedCustomers.filter((customer) => customer.stage === stage || customer.nextReminder.includes("逾期"));
  if (ruleType === "high_value_revisit") return scopedCustomers.filter((customer) => customer.amount >= 30000 || customer.health < 65);
  if (ruleType === "custom_due") return scopedCustomers.filter((customer) => customer.stage === stage);
  return scopedCustomers.filter((customer) => customer.stage === stage || customer.nextReminder.includes("逾期"));
}

function todoTypeLabel(type: string) {
  const map: Record<string, string> = {
    customer: "客户跟进",
    knowledge: "资料维护",
    exam: "在线考试",
    ocr: "OCR 线索",
    other: "其它"
  };
  return map[type] || "其它";
}

function moneyText(value: number) {
  return `$${Math.round(value / 1000)}k`;
}

function currentMinuteText() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type AiUseCase = "leadFinder" | "websiteParse" | "scoring" | "emailDraft" | "exam";

function getAiConfigs(user: SessionUser) {
  return getStore().aiModelConfigs
    .filter((item) => item.ownerId === user.id)
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function configSupportsUseCase(config: AiModelConfig, useCase?: AiUseCase) {
  if (!useCase) return true;
  const map: Record<AiUseCase, keyof AiModelConfig> = {
    leadFinder: "useLeadFinder",
    websiteParse: "useWebsiteParse",
    scoring: "useScoring",
    emailDraft: "useEmailDraft",
    exam: "useExam"
  };
  return Boolean(config[map[useCase]]);
}

function getAiConfig(user: SessionUser, useCase?: AiUseCase) {
  const configs = getAiConfigs(user);
  return configs.find((item) => item.enabled && item.apiKey && configSupportsUseCase(item, useCase))
    || configs.find((item) => configSupportsUseCase(item, useCase))
    || configs[0]
    || null;
}

function publicAiConfig(config: AiModelConfig) {
  return {
    id: config.id,
    provider: config.provider,
    protocol: config.protocol || "openai-compatible",
    name: config.name,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey ? `****${config.apiKey.slice(-4)}` : "",
    hasApiKey: Boolean(config.apiKey),
    enabled: config.enabled,
    temperature: config.temperature ?? 0.1,
    useLeadFinder: config.useLeadFinder ?? true,
    useWebsiteParse: config.useWebsiteParse ?? true,
    useScoring: config.useScoring ?? true,
    useEmailDraft: config.useEmailDraft ?? true,
    useExam: config.useExam ?? false,
    lastTestAt: config.lastTestAt || "",
    lastTestStatus: config.lastTestStatus || "untested",
    lastTestMessage: config.lastTestMessage || "",
    ownerId: config.ownerId,
    teamId: config.teamId,
    updatedAt: config.updatedAt
  };
}

async function testAiConfig(config: AiModelConfig) {
  try {
    const content = await callAiModel(config, "只返回 JSON：{\"ok\":true}", 1200);
    const ok = /ok|true/i.test(content);
    return {
      ok,
      message: ok ? `${providerLabel(config.provider)} 连接测试通过` : "模型已响应，但返回内容不符合测试格式"
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `AI 连接失败：${error.message}` : "AI 连接失败，请检查 Base URL / Key / Model"
    };
  }
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Claude",
    gemini: "Gemini",
    deepseek: "DeepSeek",
    qwen: "通义千问",
    moonshot: "Kimi",
    zhipu: "智谱GLM",
    baidu: "百度千帆",
    volcengine: "豆包",
    mistral: "Mistral",
    groq: "Groq",
    openrouter: "OpenRouter",
    ollama: "Ollama",
    custom: "自定义模型"
  };
  return labels[provider] || provider || "AI模型";
}

function normalizeWebsite(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function leadFinderQueryText(body: z.infer<typeof leadFinderSearchSchema>) {
  return [body.goal, body.productKeywords, body.industry, body.customerType, body.countries]
    .join(" ")
    .replace(/[,，/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchGleifLeads(body: z.infer<typeof leadFinderSearchSchema>, user: SessionUser, limit: number): Promise<WebsiteOpportunity[]> {
  const firstCountry = body.countries.split(/,|，/)[0]?.trim();
  const firstIndustry = body.industry.split(/,|，/)[0]?.trim();
  const firstProduct = body.productKeywords.split(/,|，/)[0]?.trim();
  const queryCandidates = [
    leadFinderQueryText(body),
    [firstIndustry, firstCountry].filter(Boolean).join(" "),
    [firstProduct, firstCountry].filter(Boolean).join(" "),
    [body.customerType, firstCountry].filter(Boolean).join(" "),
    firstIndustry || firstProduct || firstCountry || "automation"
  ].filter(Boolean);
  try {
    let records: Array<{
      id?: string;
      attributes?: {
        lei?: string;
        entity?: {
          legalName?: { name?: string };
          legalAddress?: { country?: string; city?: string };
          headquartersAddress?: { country?: string; city?: string };
        };
      };
    }> = [];
    for (const query of queryCandidates) {
      const url = `https://api.gleif.org/api/v1/lei-records?filter[fulltext]=${encodeURIComponent(query)}&page[size]=${limit}`;
      const response = await fetch(url, { headers: { accept: "application/vnd.api+json" } });
      if (!response.ok) continue;
      const data = await response.json() as { data?: typeof records };
      records = data.data || [];
      if (records.length) break;
    }
    return records.slice(0, limit).map((item, index) => {
      const entity = item.attributes?.entity;
      const company = entity?.legalName?.name || `GLEIF Entity ${index + 1}`;
      const country = entity?.legalAddress?.country || entity?.headquartersAddress?.country || body.countries.split(/,|，/)[0]?.trim() || "未知";
      const city = entity?.legalAddress?.city || entity?.headquartersAddress?.city || "";
      const lei = item.attributes?.lei || item.id || "";
      return {
        id: `lf_gleif_${Date.now()}_${index}`,
        company,
        business: body.productKeywords || body.industry || "法人实体 / 待核实业务",
        country,
        website: lei ? `https://search.gleif.org/#/record/${lei}` : "https://search.gleif.org/",
        contact: "待维护",
        contactInfo: "",
        description: `GLEIF公开法人实体。${city ? `城市：${city}。` : ""}需继续核实官网、采购角色和产品匹配。`,
        ownerId: user.id,
        teamId: user.teamId,
        status: "preview" as const,
        createdAt: new Date().toISOString(),
        parseMode: "rule" as const
      };
    });
  } catch {
    return [];
  }
}

async function searchWikidataLeads(body: z.infer<typeof leadFinderSearchSchema>, user: SessionUser, limit: number): Promise<WebsiteOpportunity[]> {
  const firstCountry = body.countries.split(/,|，/)[0]?.trim();
  const firstIndustry = body.industry.split(/,|，/)[0]?.trim();
  const firstProduct = body.productKeywords.split(/,|，/)[0]?.trim();
  const queryCandidates = [
    leadFinderQueryText(body),
    [firstProduct, firstIndustry, firstCountry].filter(Boolean).join(" "),
    [firstIndustry, "company"].filter(Boolean).join(" "),
    firstProduct || firstIndustry || "instrumentation company"
  ].filter(Boolean);
  try {
    let records: Array<{ id?: string; label?: string; description?: string; concepturi?: string }> = [];
    for (const query of queryCandidates) {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json&type=item&limit=${limit}&search=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) continue;
      const data = await response.json() as { search?: typeof records };
      records = data.search || [];
      if (records.length) break;
    }
    return records
      .filter((item) => item.label)
      .slice(0, limit)
      .map((item, index) => ({
        id: `lf_wikidata_${Date.now()}_${index}`,
        company: item.label || `Wikidata Entity ${index + 1}`,
        business: body.productKeywords || body.industry || item.description || "公开实体 / 待核实业务",
        country: body.countries.split(/,|，/)[0]?.trim() || "未知",
        website: item.concepturi || (item.id ? `https://www.wikidata.org/wiki/${item.id}` : "https://www.wikidata.org/"),
        contact: "待维护",
        contactInfo: "",
        description: `Wikidata公开实体：${item.description || "描述待补充"}。需继续核实官网、联系人和真实采购意向。`,
        ownerId: user.id,
        teamId: user.teamId,
        status: "preview" as const,
        createdAt: new Date().toISOString(),
        parseMode: "rule" as const
      }));
  } catch {
    return [];
  }
}

async function parseWebsiteOpportunity(rawUrl: string, index: number, user: SessionUser, aiConfig?: AiModelConfig | null): Promise<WebsiteOpportunity> {
  const website = normalizeWebsite(rawUrl);
  let html = "";
  let finalUrl = website;
  let fetchNote = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(website, {
      signal: controller.signal,
      headers: { "user-agent": "GoodJobCRM/1.0 opportunity research" }
    });
    clearTimeout(timeout);
    finalUrl = response.url || website;
    html = response.ok ? await response.text() : "";
    if (!response.ok) fetchNote = `官网返回 ${response.status}，已使用域名与可公开信息生成待核实商机。`;
  } catch {
    fetchNote = "官网暂时无法直接读取，已使用域名生成待核实商机。";
  }
  const text = cleanHtml(html).slice(0, 8000);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || "";
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) || "";
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].slice(0, 4).map((item) => cleanHtml(item[1])).filter(Boolean);
  const emails = [...new Set((html + " " + text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(0, 3);
  const phones = [...new Set((text.match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || []).map((item) => item.trim()))].slice(0, 2);
  const wechat = firstMatch(text, /(?:WeChat|微信)[:：\s]*([A-Za-z0-9_-]{5,})/i);
  const whatsapp = firstMatch(text, /(?:WhatsApp|Whatsapp|WA)[:：\s]*([+\d\s().-]{7,})/i);
  const contactInfo = [emails[0], whatsapp ? `WhatsApp ${whatsapp}` : "", wechat ? `微信 ${wechat}` : "", phones[0]].filter(Boolean).join(" / ");
  const url = new URL(finalUrl);
  const company = companyFromTitle(title, url.hostname);
  const business = inferBusiness([title, description, ...headings, text].join(" "));
  const country = inferCountry(finalUrl, text);
  const contact = inferContact(text);
  const detail = [description || headings.join("；") || `${company} 官网产品信息待复核`, fetchNote].filter(Boolean).join(" ");
  const ruleResult: WebsiteOpportunity = {
    id: `web_${Date.now()}_${index}`,
    company,
    business,
    country,
    website: finalUrl,
    contact,
    contactInfo: contactInfo || "待维护",
    description: detail.slice(0, 260),
    ownerId: user.id,
    teamId: user.teamId,
    status: "preview",
    createdAt: new Date().toISOString(),
    parseMode: "rule"
  };
  if (!aiConfig?.enabled || !aiConfig.apiKey || !aiConfig.useWebsiteParse) return ruleResult;
  try {
    const ai = await parseWebsiteWithAi(aiConfig, {
      website: finalUrl,
      title,
      description,
      headings,
      text,
      ruleResult
    });
    return {
      ...ruleResult,
      company: ai.company || ruleResult.company,
      business: ai.business || ruleResult.business,
      country: ai.country || ruleResult.country,
      contact: ai.contact || ruleResult.contact,
      contactInfo: ai.contactInfo || ruleResult.contactInfo,
      description: `${ai.description || ruleResult.description}（AI解析）`.slice(0, 320),
      parseMode: "ai"
    };
  } catch {
    return {
      ...ruleResult,
      description: `${ruleResult.description} AI解析失败，已自动回退规则解析。`.slice(0, 320),
      parseMode: "fallback"
    };
  }
}

async function aiGenerateLeads(query: LeadQuery, config: AiModelConfig): Promise<RawLead[]> {
  const n = Math.min(query.limit, 12);
  const prompt = [
    "你是资深外贸获客研究助手。根据下面的客户画像，列出真实、可能存在的目标公司（分销商/系统集成商/OEM/EPC/MRO/终端工厂/贸易商等）。",
    "严格只返回 JSON，不要解释、不要 Markdown。",
    "JSON 结构：{\"companies\":[{\"company\":\"\",\"website\":\"\",\"country\":\"\",\"business\":\"\",\"description\":\"\"}]}",
    "要求：",
    "1. 只给你有把握真实存在的公司；website 用你所知的官网域名，不确定就留空字符串，绝不编造域名。",
    "2. 绝不编造邮箱、电话或联系人。",
    "3. business 聚焦公司产品/业务方向；description 用一句话说明为何匹配画像。",
    `目标公司数量：${n}`,
    `产品/关键词：${query.productKeywords || "未指定"}`,
    `国家/地区：${query.countries || "未指定"}`,
    `行业/场景：${query.industry || "未指定"}`,
    `客户类型：${query.customerType || "未指定"}`,
    `获客目标：${query.goal || "未指定"}`,
    `排除：${query.excludeKeywords || "无"}`
  ].join("\n");
  const content = await callAiModel(config, prompt, 4000);
  const parsed = extractJsonObject(content) as { companies?: unknown };
  const companies = Array.isArray(parsed.companies) ? parsed.companies : [];
  return companies
    .slice(0, n)
    .map((raw): RawLead => {
      const item = (raw || {}) as Record<string, unknown>;
      const firstCountry = query.countries.split(/,|，/)[0]?.trim() || "未知";
      const detail = String(item.description || "").trim();
      return {
        company: String(item.company || "").trim(),
        website: String(item.website || "").trim(),
        country: String(item.country || firstCountry).trim(),
        business: String(item.business || query.productKeywords || "待核实业务").trim(),
        contact: "待维护",
        contactInfo: "",
        description: `${detail}${detail ? "（AI 生成，待核实）" : "AI 生成候选，待核实。"}`,
        confidence: 58
      };
    })
    .filter((lead) => lead.company);
}

async function parseWebsiteWithAi(config: AiModelConfig, context: {
  website: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  ruleResult: WebsiteOpportunity;
}) {
  const prompt = [
    "你是外贸CRM商机研究助手。请从官网文本中提取真实商机字段。",
    "只返回严格 JSON，不要 Markdown，不要解释。",
    "JSON字段：company,business,country,website,contact,contactInfo,description。",
    "业务字段要聚焦产品/服务；联系人和联系方式没有就写“待维护”；不要编造不存在的邮箱电话。",
    `官网：${context.website}`,
    `标题：${context.title}`,
    `Meta：${context.description}`,
    `标题组：${context.headings.join("；")}`,
    `规则初稿：${JSON.stringify(context.ruleResult)}`,
    `正文：${context.text.slice(0, 10000)}`
  ].join("\n");
  const content = await callAiModel(config, prompt, 12000);
  const parsed = extractJsonObject(content);
  return {
    company: String(parsed.company || "").trim(),
    business: String(parsed.business || "").trim(),
    country: String(parsed.country || "").trim(),
    website: String(parsed.website || context.website).trim(),
    contact: String(parsed.contact || "").trim(),
    contactInfo: String(parsed.contactInfo || parsed.contact_info || "").trim(),
    description: String(parsed.description || "").trim()
  };
}

async function callAiModel(config: AiModelConfig, prompt: string, maxInputChars = 12000) {
  const protocol = config.protocol || "openai-compatible";
  const endpointBase = config.baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeoutMs = 100000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (protocol === "anthropic") {
      const response = await fetch(`${endpointBase}/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1800,
          temperature: config.temperature ?? 0.1,
          system: "你擅长把官网公开信息整理成外贸CRM商机。输出必须可被 JSON.parse 解析。",
          messages: [{ role: "user", content: prompt.slice(0, maxInputChars) }]
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
      const content = data.content?.map((item) => item.text || "").join("\n").trim() || "";
      if (!content) throw new Error("模型返回为空");
      return content;
    }
    if (protocol === "gemini") {
      const response = await fetch(`${endpointBase}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationConfig: { temperature: config.temperature ?? 0.1, maxOutputTokens: 1800 },
          contents: [{
            role: "user",
            parts: [{ text: `你擅长把官网公开信息整理成外贸CRM商机。输出必须可被 JSON.parse 解析。\n${prompt.slice(0, maxInputChars)}` }]
          }]
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const content = data.candidates?.[0]?.content?.parts?.map((item) => item.text || "").join("\n").trim() || "";
      if (!content) throw new Error("模型返回为空");
      return content;
    }
    const endpoint = `${endpointBase}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1800,
        temperature: config.temperature ?? 0.1,
        messages: [
          { role: "system", content: "你擅长把官网公开信息整理成外贸CRM商机。输出必须可被 JSON.parse 解析。" },
          { role: "user", content: prompt.slice(0, maxInputChars) }
        ]
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    if (!content.trim()) throw new Error("模型返回为空");
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI model request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(content: string) {
  const source = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI JSON missing");
  return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
}

function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp) {
  return cleanHtml(value.match(pattern)?.[1] || "");
}

function companyFromTitle(title: string, hostname: string) {
  const host = hostname.replace(/^www\./, "").split(".")[0];
  const fromTitle = title.split(/[-|–—]/)[0]?.trim();
  const raw = fromTitle && fromTitle.length >= 3 ? fromTitle : host;
  return raw.replace(/\b(home|official|website|products?)\b/gi, "").replace(/\s+/g, " ").trim() || host;
}

function inferBusiness(text: string) {
  const lower = text.toLowerCase();
  const dictionary = [
    ["pressure", "压力仪表 / Pressure transmitter"],
    ["flow", "流量仪表 / Flow meter"],
    ["temperature", "温度仪表 / Temperature sensor"],
    ["level", "液位仪表 / Level meter"],
    ["sensor", "工业传感器 / Industrial sensor"],
    ["instrument", "工业仪表 / Instrumentation"],
    ["meter", "仪表计量 / Metering products"],
    ["valve", "阀门与过程控制 / Valve control"]
  ];
  const matched = dictionary.filter(([keyword]) => lower.includes(keyword)).map(([, label]) => label);
  return [...new Set(matched)].slice(0, 3).join("；") || "官网产品待核实";
}

function inferCountry(url: string, text: string) {
  const lower = `${url} ${text}`.toLowerCase();
  const rules: Array<[string, string]> = [
    [".de", "德国"], [".co.uk", "英国"], [".uk", "英国"], [".fr", "法国"], [".it", "意大利"], [".es", "西班牙"],
    [".us", "美国"], [".com.au", "澳大利亚"], [".ca", "加拿大"], [".jp", "日本"], [".kr", "韩国"], [".in", "印度"],
    ["germany", "德国"], ["united kingdom", "英国"], ["usa", "美国"], ["japan", "日本"], ["india", "印度"], ["china", "中国"]
  ];
  return rules.find(([key]) => lower.includes(key))?.[1] || "未知";
}

function inferContact(text: string) {
  const match = text.match(/(?:Contact|Sales|Manager|Director)[:：\s]+([A-Z][A-Za-z\s.-]{2,40})/);
  return cleanHtml(match?.[1] || "") || "待维护";
}

app.get("/api/reports/executive", requireAuth, (req, res) => {
  const { customers } = getStore();
  const scopedCustomers = customers.filter((customer) => canSeeOwner(req.user!, customer.ownerId, customer.teamId));
  res.json({
    title: "2026 年 6 月外贸销售经营汇报",
    forecastAmount: scopedCustomers.reduce((sum, customer) => sum + customer.amount, 0),
    conversionRate: 18.6,
    riskAmount: scopedCustomers.filter((customer) => customer.nextReminder === "已逾期").reduce((sum, customer) => sum + customer.amount, 0),
    conclusions: [
      "成交预测可达成",
      "报价跟进是短板",
      "欧洲市场质量最高",
      "培训影响转化"
    ]
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "参数格式错误", issues: error.issues });
    return;
  }
  const message = error instanceof Error ? error.message : "服务器错误";
  res.status(500).json({ message });
});

async function startServer() {
  const port = Number(process.env.PORT || 4188);
  if (process.env.CRM_STORE === "mysql" || process.env.DATABASE_URL || process.env.MYSQL_URL) {
    try {
      const store = await createMysqlStore();
      setStore(store);
      console.log("GoodJob CRM using MySQL persistence");
    } catch (error) {
      console.warn(`GoodJob CRM MySQL unavailable, using memory store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  app.listen(port, () => {
    console.log(`GoodJob CRM API listening on http://127.0.0.1:${port}`);
  });
  scheduleMidnightTodoArchive();
}

if (process.env.NODE_ENV !== "test") {
  void startServer();
}
