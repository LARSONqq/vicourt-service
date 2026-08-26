export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent: string | null;
};

export type CurrentPushSubscription = {
  id: string;
  endpoint: string;
};

export type PushActionResult =
  | {
      success: true;
      message: string;
      subscription?: CurrentPushSubscription;
    }
  | {
      success: false;
      message: string;
      subscriptionRemoved?: boolean;
    };

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
};

export type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
};
