'use client';
import { useState } from 'react';
import supabase from '../lib/supabase-integration';

export default function DeltaCCAuth() {
  const [form, setForm] = useState({
    agency_name: 'The Real Vacations via Cruise Brothers Anywhere Inc.',
    agency_id: '41751032',
    signatory_name: '',
    signatory_title: '',
    signature: '',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from('contact_submissions').insert([{
      full_name: form.signatory_name,
      email: 'admin@therealvacations.com',
      message: `DELTA VACATIONS CC AUTH — Agency: ${form.agency_name}, Agency ID: ${form.agency_id}, Signatory: ${form.signatory_name}, Title: ${form.signatory_title}, Signed: ${form.signature}, Date: ${form.date}`,
      trip_interest: 'Delta Vacations CC Authorization',
    }]);
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl p-10 max-w-md text-center shadow-xl">
        <span className="text-5xl block mb-4">✅</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Agreement Submitted</h2>
        <p className="text-gray-500">The Delta Vacations Credit Card Usage Agreement has been signed and recorded.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Document Header */}
        <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
          <div className="p-6 flex justify-between items-start border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Travel Agency Credit Card</h1>
              <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Usage Agreement</h2>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <div>
                  <p className="text-blue-700 font-black text-xl tracking-widest">DELTA</p>
                  <p className="text-blue-700 font-bold text-sm tracking-widest">VACATIONS</p>
                </div>
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-black text-lg">▲</div>
              </div>
            </div>
          </div>

          {/* Preamble */}
          <div className="p-6 text-sm text-gray-700 leading-relaxed space-y-3 border-b border-gray-200">
            <p className="text-center">This Agreement entered into between Delta Vacations, LLC (Delta Vacations or DLV) and</p>
            <div className="flex gap-4 items-end">
              <div className="flex-1 border-b border-gray-400 pb-1 text-gray-800 font-medium">{form.agency_name}</div>
              <span className="shrink-0 text-gray-600">(Agency Name) Agency ID:</span>
              <div className="w-32 border-b border-gray-400 pb-1 text-gray-800 font-medium">{form.agency_id}</div>
            </div>
            <p>Whereas, Delta Vacations has entered in Merchant Agreements with credit card processors (Processor), pursuant to which DLV has obtained the right to honor select credit cards in connection with sales of its products and services; and whereas, Agency desires to have the right to honor such credit card types deemed acceptable to DLV in connection with its sales of DLV products and services.</p>
            <p>Therefore, in consideration of the premises of the mutual promises herein, it is agreed as follows:</p>
          </div>

          {/* Terms */}
          <div className="p-6 text-sm text-gray-700 leading-relaxed space-y-3 border-b border-gray-200">
            <div>
              <p className="font-semibold mb-1">1. Definitions:</p>
              <ul className="ml-4 space-y-1">
                <li><strong>Qualified Credit Card</strong> shall mean a credit card of the type deemed acceptable to DLV, issued by issuers licensed to use said service marks (herein called Issuers), which are valid, have not been revoked, have not expired, and show no evidence of having been altered or defaced.</li>
                <li><strong>Credit Card Charge Form</strong> shall mean Universal Credit Card Usage Agreement Charge Form (ARC form-1201).</li>
                <li><strong>Credit Card Refund Notice</strong> shall mean Credit Card Refund/Exchange Notice.</li>
              </ul>
            </div>
            <p><strong>2.</strong> The Agency agrees to follow all procedures set forth in this agreement and the attached Delta Vacations Credit Card Operating Procedures (Operating Procedures).</p>
            <p><strong>3.</strong> The Agency will present to DLV, for purchase only, a valid debt arising from legal and bona fide sales of DLV products. Agency understands that an authorization indicates only the availability of credit at the time of the authorization. Agency is still responsible for confirming that the person presenting the card is the rightful cardholder, and for following all other Operating Procedures. Failure to follow these procedures may result in chargebacks of any debt to Agency.</p>
            <p><strong>4.</strong> Agency understands that only Delta Vacations' products and services are covered by the Merchant Agreements.</p>
            <p><strong>5.</strong> Agency agrees that all trademarks and trade names shall remain the exclusive property of the licensed Issuer; that Agency will not alter such trademarks or trade names in any manner; and the Agency's right to use them shall terminate upon termination of the Agreement.</p>
            <p><strong>6.</strong> Agency will obtain the cardholder's signature on a valid Credit Card Charge Form before submitting any charge to DLV. If Agency does not obtain a valid signature or chooses to use any other form of authorization from the cardholder, such as, and not limited to, "signature on file," etc., the Agency agrees to be liable to DLV for any charges that the cardholder refuses to pay, such as tour costs, cancellation fees, service fees, etc.</p>
            <p><strong>7.</strong> Nothing contained in this Agreement shall be construed to mean that Agency, employees, or servants of either party are deemed for any purpose the Agency, employees, or servants of the other party.</p>
            <p><strong>8.</strong> DLV may change the Operating Procedures from time to time by giving notice to the Agency ten (10) calendar days before the change becomes effective. Should it become necessary for DLV to require that the Agency pay any portion of the costs involved in processing credit card transactions, notice will be given the Agency at least thirty (30) calendar days before the charge becomes effective.</p>
            <p><strong>9.</strong> This Agreement shall become effective upon the date signed by Agency Owner or Manager, and shall remain in full force and effect until terminated by either party by giving of written notice to the other party. All obligations incurred or existing under this Agreement as of the date of termination shall survive such termination. This Agreement shall be governed by the laws of the State of Minnesota, and shall be binding upon the successors, assigns, and legal representatives of the party.</p>
            <div>
              <p className="font-semibold mb-1">10. Agency agrees to:</p>
              <ul className="ml-4 space-y-1 list-none">
                <li><strong>A.</strong> Honor all valid Qualified Credit Cards subject to the procedures in this Agreement, in connection with bankcard sales and refunds.</li>
                <li><strong>B.</strong> Conduct all bankcard transactions in accordance with this agreement and the Operating Procedures (together with modifications thereof), and to full and legibly complete each sales draft of credit card voucher.</li>
                <li><strong>C.</strong> Upon request, submit the Credit Card Charge Form and Credit Card Refund Notice completed according to Operating Procedures to DLV within three (3) business days.</li>
                <li><strong>D.</strong> Not obtain approval code for the credit card transaction unless specifically requested to do so by DLV, and reimburse DLV for charges for an approval code obtained unnecessarily by the Agency should there be a charge to DLV.</li>
                <li><strong>E.</strong> In the event of a sales draft in an amount less than the total sales price, obtain the balance in cash from the cardholder.</li>
                <li><strong>F.</strong> Not assess a credit card surcharge on any Qualified Credit Card transaction.</li>
                <li><strong>G.</strong> Not establish a minimum or maximum dollar limit on any Qualified Credit Card transaction.</li>
                <li><strong>H.</strong> Not, without the Qualified Credit Cardholder's consent, sell, purchase, provide, or exchange Credit Card account number information to any third party other than to DLV, Agency's agents (for the purpose of Agency's business), Processor, licensed Issuers, or pursuant to a government request or legal process.</li>
                <li><strong>I.</strong> Reimburse DLV for any fees, charges, fines, assessments, penalties, and chargebacks it may be required to pay, incur, or purchase with regard to any debt purchased by DLV from Agency including, but not limited to, sales on counterfeit, altered, or ineligible cards or other fraudulent transactions required to be paid or repurchased by DLV by virtue of Processor, or licensed Issuers, without regard to time limitations specified elsewhere in this Agreement or in the Operating Procedures.</li>
                <li><strong>J.</strong> Maintain DLV's cancellation policy for sales made on bankcard sales drafts, and to give non-cash credit through the use of a bank credit voucher upon such cancellation in accordance with the Operating Procedures.</li>
                <li><strong>K.</strong> Preserve all records regarding any Qualified Credit Card transaction for a period of at least one year from the date of such transaction, permit DLV and Processor to examine Agency's books and records concerning the transaction, and provide Processor and DLV with such additional information as they may reasonably require concerning the transactions.</li>
              </ul>
            </div>
          </div>

          {/* Signature Section */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-8">
              {/* DLV Side */}
              <div>
                <p className="font-semibold text-gray-800 mb-4">Delta Vacations, LLC</p>
                <div className="mb-6">
                  <p className="text-3xl italic text-gray-700 mb-1" style={{ fontFamily: 'Georgia, serif' }}>Kama Winters</p>
                  <div className="border-b border-gray-400 mb-1"></div>
                  <p className="text-xs text-gray-500">By: Kama Winters, President</p>
                </div>
              </div>

              {/* Agency Side */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Agency Name</label>
                  <div className="border-b border-gray-400 pb-1 text-sm text-gray-800">{form.agency_name}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Signature* <span className="text-gray-400">(type your name)</span></label>
                  <input
                    className="w-full border-b border-gray-400 pb-1 text-xl italic outline-none bg-transparent focus:border-blue-600"
                    style={{ fontFamily: 'Georgia, serif' }}
                    placeholder="Sign here..."
                    value={form.signature}
                    onChange={e => setForm({...form, signature: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name*</label>
                  <input className="w-full border-b border-gray-400 pb-1 text-sm outline-none bg-transparent focus:border-blue-600"
                    value={form.signatory_name} onChange={e => setForm({...form, signatory_name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title*</label>
                  <input className="w-full border-b border-gray-400 pb-1 text-sm outline-none bg-transparent focus:border-blue-600"
                    value={form.signatory_title} onChange={e => setForm({...form, signatory_title: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <div className="border-b border-gray-400 pb-1 text-sm text-gray-800">{form.date}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Agency ID</label>
                  <div className="border-b border-gray-400 pb-1 text-sm text-gray-800">{form.agency_id}</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">*Agency signor must be Owner, Manager or other party responsible for Agency's policies & procedures.</p>

            <button onClick={handleSubmit} disabled={loading}
              className="mt-6 w-full bg-blue-700 text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Submitting...' : '✅ Submit Signed Agreement to Delta Vacations'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
