CREATE TABLE "bank_screen_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_code" text NOT NULL,
	"flow_config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_screen_flows_bank_code_unique" UNIQUE("bank_code")
);
--> statement-breakpoint
CREATE TABLE "bank_subdomains" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_code" text NOT NULL,
	"subdomain" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_subdomains_bank_code_unique" UNIQUE("bank_code")
);
--> statement-breakpoint
CREATE TABLE "link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" integer,
	"bank_code" text NOT NULL,
	"token" text NOT NULL,
	"original_url" text NOT NULL,
	"short_url" text,
	"bitly_link_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"extended_until" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "link_usage_weekly" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"link_count" integer DEFAULT 0 NOT NULL,
	"last_generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "link_usage_weekly_user_id_week_start_date_unique" UNIQUE("user_id","week_start_date")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"is_connected" boolean DEFAULT false,
	"qr_code" text,
	"auth_state" jsonb,
	"phone_number" text,
	"welcome_message" text DEFAULT '¡Hola! Bienvenido a nuestro CRM. Por favor selecciona una opción:',
	"last_connected" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"phone_number" text NOT NULL,
	"contact_name" text,
	"message" text NOT NULL,
	"is_from_bot" boolean DEFAULT false,
	"message_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_menu_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"parent_id" integer,
	"option_number" integer NOT NULL,
	"option_text" text NOT NULL,
	"action_type" text DEFAULT 'message' NOT NULL,
	"response_message" text,
	"command_type" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bank_screen_flows" ADD CONSTRAINT "bank_screen_flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_usage_weekly" ADD CONSTRAINT "link_usage_weekly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_config" ADD CONSTRAINT "whatsapp_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_menu_options" ADD CONSTRAINT "whatsapp_menu_options_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executives" ADD CONSTRAINT "executives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_profiles" ADD CONSTRAINT "office_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_executive_id_executives_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."executives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "parent_office_id";