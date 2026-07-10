import jwt from "jsonwebtoken";
const JWT_SECRET = "goodjob-crm-dev-secret";
export function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        avatar: user.avatar,
        outboundEmail: user.outboundEmail || "",
        emailSenderName: user.emailSenderName || user.name,
        emailSignature: user.emailSignature || "",
        smtpHost: user.smtpHost || "",
        smtpPort: user.smtpPort || 465,
        smtpSecure: user.smtpSecure ?? true,
        smtpUser: user.smtpUser || "",
        hasSmtpPassword: Boolean(user.smtpPassword),
        lastDevelopmentEmailAt: user.lastDevelopmentEmailAt || "",
        lastDevelopmentEmailTo: user.lastDevelopmentEmailTo || "",
        lastDevelopmentEmailSubject: user.lastDevelopmentEmailSubject || ""
    };
}
export function signToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
}
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
        res.status(401).json({ message: "未登录" });
        return;
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    }
    catch {
        res.status(401).json({ message: "登录已过期" });
    }
}
export function canSeeOwner(user, ownerId, teamId) {
    if (user.role === "admin" || user.role === "super_admin")
        return true;
    if (user.role === "manager")
        return user.teamId === teamId;
    return user.id === ownerId;
}
export function canSeePersonalData(user, ownerId) {
    return user.id === ownerId;
}
export function canManageAccounts(user) {
    return user?.role === "admin" || user?.role === "super_admin";
}
export function canManageRole(operator, targetRole) {
    if (operator.role === "super_admin")
        return true;
    if (operator.role !== "admin")
        return false;
    return targetRole !== "super_admin";
}
