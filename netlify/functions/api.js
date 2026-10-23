import route0 from "../../api/admin-configure-custom-payment.js";
import route1 from "../../api/admin-create-confirmed-payment-link.js";
import route2 from "../../api/admin-invite-supplier.js";
import route3 from "../../api/admin-record-log.js";
import route4 from "../../api/admin-request-email-change.js";
import route5 from "../../api/admin-reset-quote-response.js";
import route6 from "../../api/admin-stripe-account.js";
import route7 from "../../api/approve-quote-option.js";
import route8 from "../../api/config-health.js";
import route9 from "../../api/confirm-custom-payment.js";
import route10 from "../../api/confirm-request-payment.js";
import route11 from "../../api/create-custom-checkout.js";
import route12 from "../../api/create-customer-portal.js";
import route13 from "../../api/create-host-checkout.js";
import route14 from "../../api/create-payment-method-setup.js";
import route15 from "../../api/create-vip-checkout.js";
import route16 from "../../api/report-problem.js";
import route17 from "../../api/save-payment-method.js";
import route18 from "../../api/send-quote-ready.js";
import route19 from "../../api/submit-contact.js";
import route20 from "../../api/submit-quote-selection.js";
import route21 from "../../api/submit-service-request.js";
import route22 from "../../api/submit-trivia-entry.js";
import route23 from "../../api/update-vip-gift.js";

const routes = {
  "admin-configure-custom-payment": route0,
  "admin-create-confirmed-payment-link": route1,
  "admin-invite-supplier": route2,
  "admin-record-log": route3,
  "admin-request-email-change": route4,
  "admin-reset-quote-response": route5,
  "admin-stripe-account": route6,
  "approve-quote-option": route7,
  "config-health": route8,
  "confirm-custom-payment": route9,
  "confirm-request-payment": route10,
  "create-custom-checkout": route11,
  "create-customer-portal": route12,
  "create-host-checkout": route13,
  "create-payment-method-setup": route14,
  "create-vip-checkout": route15,
  "report-problem": route16,
  "save-payment-method": route17,
  "send-quote-ready": route18,
  "submit-contact": route19,
  "submit-quote-selection": route20,
  "submit-service-request": route21,
  "submit-trivia-entry": route22,
  "update-vip-gift": route23,
};

/** Compatibility adapter for existing Vercel-style handlers.
 * This preserves their auth/payment validation during the hosting migration.
 * All routes must be integration-tested on a preview site before DNS cutover.
 */
export async function handler(event) {
  const pathname = event.path || "";
  const route = decodeURIComponent(pathname.split("/").pop() || "");
  const endpoint = routes[route];
  if (!endpoint) return { statusCode: 404, body: JSON.stringify({error:"API route not found"}),headers:{"content-type":"application/json"} };
  let body = event.body;
  if (event.isBase64Encoded && body) body = Buffer.from(body, "base64").toString("utf8");
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (body && typeof body === "string" && contentType.includes("application/json")) {
    try { body = JSON.parse(body); } catch { return {statusCode:400,body:JSON.stringify({error:"Invalid JSON"})}; }
  }
  const headers = {};
  const response = {
    statusCode: 200,
    data: "",
    status(n) { this.statusCode = n; return this; },
    setHeader(name, value) { headers[name] = value; return this; },
    getHeader(name) { return headers[name]; },
    json(value) { headers["content-type"] = "application/json"; this.data = JSON.stringify(value); return this; },
    send(value) { this.data = typeof value === "string" ? value : JSON.stringify(value); return this; },
    end(value) { if (value != null) this.data = String(value); return this; },
    redirect(statusOrLocation, location) { this.statusCode = location ? statusOrLocation : 302; headers.location = location || statusOrLocation; return this; }
  };
  const query = event.queryStringParameters || {};
  const request = {method:event.httpMethod,headers:event.headers||{},body,query,url:event.rawUrl||event.path};
  try {
    await endpoint(request,response);
    return {statusCode:response.statusCode,headers,body:response.data};
  } catch (error) {
    console.error("API handler failed",route,error);
    return {statusCode:500,headers:{"content-type":"application/json"},body:JSON.stringify({error:"Internal server error"})};
  }
}
