import type { order, orderStatus } from "@prisma/client";

declare type updateOrderStatusParams =
  | {
      id: number;
      chef: string;
      chefUsername: string;
      status: Exclude<
        orderStatus,
        "ORDERED" | "FILLING" | "DELIVERING" | "REJECTED" | "PACKING"
      >;
      admin?: string;
      // interactionMessageId?: string;
      // fileUrl?: string;
      // reason?: string;
    }
  | {
      id: number;
      chef: string;
      status: "REJECTED";
      admin?: string;
      reason: string;
    }
  | {
      id: number;
      chef: string;
      chefUsername: string;
      status: "DELIVERING" | "FILLING";
      admin?: string;
      interactionMessageId: string;
    }
  | {
      id: number;
      chef: string;
      chefUsername: string;
      status: "PACKING";
      admin?: string;
      fileUrl: string;
    };

declare type updateOrderStatusResponse =
  | {
      success: true;
      message: string;
      order: order;
    }
  | {
      success: false;
      message: string;
    };
