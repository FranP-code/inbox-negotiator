import { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { TestTube, Loader2 } from "lucide-react";

export function ExtractionTester() {
  const [testEmail, setTestEmail] = useState(`Thank you for your payment arrangement request. We are pleased to offer you a structured payment plan. We can accept $250 per month for 18 months, totaling $4,500. This arrangement will allow you to resolve this matter with manageable monthly payments.`);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testExtraction = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/supabase/functions/test-extraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testEmail }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        toast.success("Extraction Test Complete", {
          description: `Found ${Object.keys(data.extractedTerms || {}).length} extracted terms`,
        });
      } else {
        toast.error("Extraction Test Failed", {
          description: data.error || "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error testing extraction:", error);
      toast.error("Test Failed", {
        description: "Failed to test extraction",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const presetEmails = [
    {
      name: "Payment Plan",
      content: "Thank you for your payment arrangement request. We are pleased to offer you a structured payment plan. We can accept $250 per month for 18 months, totaling $4,500. This arrangement will allow you to resolve this matter with manageable monthly payments."
    },
    {
      name: "Settlement Offer",
      content: "We are pleased to accept your proposed settlement offer of $3,200. We will process the settlement as discussed and consider this matter resolved upon receipt of payment."
    },
    {
      name: "Counter Offer",
      content: "Thank you for your proposal. However, we can only accept a settlement of $4,000 or a payment plan of $300 per month for 15 months. Please let us know which option works better for you."
    },
    {
      name: "Rejection",
      content: "Thank you for your payment proposal. Unfortunately, we cannot accept the terms you have proposed. We require the full amount of $5,000 to be paid within 30 days."
    }
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          AI Extraction Tester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Emails */}
        <div>
          <label className="text-sm font-medium mb-2 block">Preset Test Emails:</label>
          <div className="flex flex-wrap gap-2">
            {presetEmails.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => setTestEmail(preset.content)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Email Input */}
        <div>
          <label className="text-sm font-medium mb-2 block">Test Email Content:</label>
          <Textarea
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email content to test extraction..."
            rows={4}
            className="w-full"
          />
        </div>

        {/* Test Button */}
        <Button 
          onClick={testExtraction} 
          disabled={isLoading || !testEmail.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing Extraction...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4 mr-2" />
              Test AI Extraction
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Extraction Results:</h3>
              
              {/* Intent & Confidence */}
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={result.analysis?.intent === "acceptance" ? "default" : "secondary"}>
                  Intent: {result.analysis?.intent}
                </Badge>
                <Badge variant="outline">
                  Confidence: {Math.round((result.analysis?.confidence || 0) * 100)}%
                </Badge>
                <Badge variant="outline">
                  Sentiment: {result.analysis?.sentiment}
                </Badge>
              </div>

              {/* Extracted Terms */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-2">Extracted Terms:</h4>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(result.extractedTerms, null, 2)}
                </pre>
              </div>

              {/* Payment Terms Detail */}
              {result.extractedTerms?.paymentTerms && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Payment Plan Details:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {result.extractedTerms.paymentTerms.monthlyAmount && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Monthly:</span>
                        <div className="font-medium">${result.extractedTerms.paymentTerms.monthlyAmount}</div>
                      </div>
                    )}
                    {result.extractedTerms.paymentTerms.numberOfPayments && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Payments:</span>
                        <div className="font-medium">{result.extractedTerms.paymentTerms.numberOfPayments}</div>
                      </div>
                    )}
                    {result.extractedTerms.paymentTerms.totalAmount && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total:</span>
                        <div className="font-medium">${result.extractedTerms.paymentTerms.totalAmount}</div>
                      </div>
                    )}
                    {result.extractedTerms.paymentTerms.paymentFrequency && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
                        <div className="font-medium">{result.extractedTerms.paymentTerms.paymentFrequency}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Proposed Amount */}
              {result.extractedTerms?.proposedAmount && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Settlement Amount:</h4>
                  <div className="text-lg font-bold text-green-600">
                    ${result.extractedTerms.proposedAmount}
                  </div>
                </div>
              )}

              {/* Reasoning */}
              {result.analysis?.reasoning && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium mb-2">AI Reasoning:</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {result.analysis.reasoning}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
