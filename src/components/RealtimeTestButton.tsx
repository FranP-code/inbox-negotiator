import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

interface RealtimeTestButtonProps {
  debtId: string;
}

export function RealtimeTestButton({ debtId }: RealtimeTestButtonProps) {
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateIncomingMessage = async () => {
    setIsSimulating(true);
    try {
      // Randomly choose between principal reduction and payment restructuring
      const isPaymentPlan = Math.random() > 0.5;
      
      const testMessage = isPaymentPlan ? {
        // Payment restructuring scenario
        debt_id: debtId,
        message_type: "acceptance",
        direction: "inbound",
        subject: "Re: Payment Arrangement Request - Payment Plan Approved",
        body: "Thank you for your payment arrangement request. We are pleased to offer you a structured payment plan. We can accept $250 per month for 18 months, totaling $4,500. This arrangement will allow you to resolve this matter with manageable monthly payments while providing you with extended terms.",
        from_email: "collections@testcreditor.com",
        to_email: "user@example.com",
        ai_analysis: {
          intent: "acceptance",
          sentiment: "positive",
          confidence: 0.92,
          extractedTerms: {
            proposedAmount: 4500,
            proposedPaymentPlan: "monthly payment plan",
            paymentTerms: {
              monthlyAmount: 250,
              numberOfPayments: 18,
              totalAmount: 4500,
              paymentFrequency: "monthly",
              interestRate: 0
            },
            deadline: null,
            conditions: [
              "structured payment plan",
              "manageable monthly payments",
              "extended terms"
            ],
          },
          reasoning: "Creditor has accepted a payment restructuring plan with extended terms",
          suggestedNextAction: "mark_settled",
          requiresUserReview: false,
        },
      } : {
        // Principal reduction scenario
        debt_id: debtId,
        message_type: "acceptance",
        direction: "inbound",
        subject: "Re: Payment Arrangement Request - Settlement Accepted",
        body: "Thank you for your payment arrangement request. We are pleased to accept your proposed settlement offer of $3,200. We will process the settlement as discussed and consider this matter resolved upon receipt of payment.",
        from_email: "collections@testcreditor.com",
        to_email: "user@example.com",
        ai_analysis: {
          intent: "acceptance",
          sentiment: "positive",
          confidence: 0.95,
          extractedTerms: {
            proposedAmount: 3200,
            proposedPaymentPlan: "lump sum settlement",
            deadline: null,
            conditions: [
              "settlement accepted",
              "matter resolved upon payment",
            ],
          },
          reasoning: "Creditor has accepted the proposed settlement offer with principal reduction",
          suggestedNextAction: "mark_settled",
          requiresUserReview: false,
        },
      };

      const { error } = await supabase
        .from("conversation_messages")
        .insert(testMessage);

      if (error) {
        throw error;
      }

      toast.success(
        isPaymentPlan ? "🏦 Payment Plan Simulated" : "🎉 Settlement Simulated",
        {
          description: isPaymentPlan 
            ? "A payment restructuring scenario has been simulated"
            : "A principal reduction scenario has been simulated",
        }
      );

    } catch (error) {
      console.error("Error simulating message:", error);
      toast.error("Simulation Failed", {
        description: "Failed to simulate incoming message",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={simulateIncomingMessage}
      disabled={isSimulating}
      className="flex items-center gap-2"
    >
      <MessageSquare className="h-4 w-4" />
      {isSimulating ? "Simulating..." : "Test Real-time"}
    </Button>
  );
}
