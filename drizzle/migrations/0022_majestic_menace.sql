CREATE TABLE "point_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"points" integer NOT NULL,
	"price" integer NOT NULL,
	"price_per_point" real,
	"discount_percent" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "point_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" text NOT NULL,
	"points" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"portone_payment_id" text,
	"transaction_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_points" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"free_points_granted" boolean DEFAULT false,
	"monthly_points_base" integer DEFAULT 0,
	"last_recharged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "features" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "tier" SET DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "feature_list" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "point_purchases" ADD CONSTRAINT "point_purchases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_purchases" ADD CONSTRAINT "point_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_purchases" ADD CONSTRAINT "point_purchases_transaction_id_point_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."point_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_points" ADD CONSTRAINT "tenant_points_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_point_purchase_tenant" ON "point_purchases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_point_purchase_status" ON "point_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_point_purchase_created" ON "point_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_point_tx_tenant" ON "point_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_point_tx_tenant_created" ON "point_transactions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_point_tx_type" ON "point_transactions" USING btree ("type");