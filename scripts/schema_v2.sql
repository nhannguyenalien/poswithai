--
-- PostgreSQL database dump
--

\restrict cw9XHVyxSgu6vcUZ5u4sI3KHnwGc3xMavTkK3yShLk9BabaMftYH9i4t50GSnJO

-- Dumped from database version 18.4 (c9a59a4)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."activity_logs" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "user_id" "text",
    "action" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "old_data" "text",
    "new_data" "text",
    "ip_address" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: api_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."api_rate_limits" (
    "token_id" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL
);


--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."api_tokens" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "token_prefix" "text" NOT NULL,
    "created_by" "text",
    "created_at" "text" NOT NULL,
    "last_used_at" "text",
    "revoked_at" "text",
    "rate_limit_per_minute" integer DEFAULT 120 NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."brands" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text",
    "standard" "text",
    "address" "text",
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."categories" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "parent_id" "text",
    "name" "text" NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."channels" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "config" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."customer_addresses" (
    "id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "label" "text",
    "address" "text" NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: customer_debt_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."customer_debt_adjustments" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "money_amount" integer DEFAULT 0 NOT NULL,
    "gold_amount_99" real DEFAULT 0 NOT NULL,
    "note" "text",
    "created_by" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."customers" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL,
    "id_card" "text",
    "address" "text",
    "is_business" boolean DEFAULT false NOT NULL,
    "tax_code" "text",
    "support_chat_url" "text",
    "support_chat_session" "text",
    "support_chat_created_at" timestamp with time zone
);


--
-- Name: gold_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_invoice_items" (
    "id" "text" NOT NULL,
    "invoice_id" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "product_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_gross_weight" real DEFAULT 0 NOT NULL,
    "unit_stone_weight" real DEFAULT 0 NOT NULL,
    "unit_making_fee" integer DEFAULT 0 NOT NULL,
    "gold_purity" real DEFAULT 99 NOT NULL,
    "unit_net_weight" real DEFAULT 0 NOT NULL,
    "unit_converted" real DEFAULT 0 NOT NULL,
    "total_gross" real DEFAULT 0 NOT NULL,
    "total_stone" real DEFAULT 0 NOT NULL,
    "total_net" real DEFAULT 0 NOT NULL,
    "total_converted" real DEFAULT 0 NOT NULL,
    "total_making_fee" integer DEFAULT 0 NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: gold_invoice_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_invoice_returns" (
    "id" "text" NOT NULL,
    "invoice_id" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "gold_type_name" "text" NOT NULL,
    "gross_weight" real DEFAULT 0 NOT NULL,
    "stone_weight" real DEFAULT 0 NOT NULL,
    "net_weight" real DEFAULT 0 NOT NULL,
    "conversion_text" "text" DEFAULT '99/99'::"text" NOT NULL,
    "converted_weight" real DEFAULT 0 NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: gold_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_invoices" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_address" "text",
    "invoice_date" "text" NOT NULL,
    "gold_price_per_chi" integer DEFAULT 0 NOT NULL,
    "gold_delivered" real DEFAULT 0 NOT NULL,
    "gold_prev_debt" real DEFAULT 0 NOT NULL,
    "gold_transferred" real DEFAULT 0 NOT NULL,
    "gold_returned" real DEFAULT 0 NOT NULL,
    "gold_to_money" real DEFAULT 0 NOT NULL,
    "gold_remaining" real DEFAULT 0 NOT NULL,
    "gold_customer_paid" real DEFAULT 0 NOT NULL,
    "gold_customer_debt" real DEFAULT 0 NOT NULL,
    "total_making_fee" integer DEFAULT 0 NOT NULL,
    "discount_percent" real DEFAULT 0 NOT NULL,
    "money_prev_debt" integer DEFAULT 0 NOT NULL,
    "making_fee_paid_back" integer DEFAULT 0 NOT NULL,
    "gold_money_value" integer DEFAULT 0 NOT NULL,
    "invoice_discount" integer DEFAULT 0 NOT NULL,
    "total_money" integer DEFAULT 0 NOT NULL,
    "customer_paid_money" integer DEFAULT 0 NOT NULL,
    "customer_money_debt" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text",
    "created_by" "text",
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL,
    "einvoice_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "einvoice_provider" "text",
    "einvoice_number" "text",
    "einvoice_fkey" "text",
    "einvoice_pdf_url" "text",
    "einvoice_error" "text",
    "einvoice_issued_at" "text",
    "customer_tax_code" "text",
    "customer_company" "text"
);


--
-- Name: gold_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_price_history" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "gold_type_id" "text" NOT NULL,
    "buy_price" integer NOT NULL,
    "sell_price" integer NOT NULL,
    "effective_at" "text" NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: gold_product_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_product_details" (
    "id" "text" NOT NULL,
    "product_variant_id" "text" NOT NULL,
    "gold_type_id" "text" NOT NULL,
    "gross_weight" real NOT NULL,
    "stone_weight" real DEFAULT 0 NOT NULL,
    "net_weight" real NOT NULL,
    "making_fee" integer DEFAULT 0 NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: gold_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gold_types" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "purity" real,
    "created_at" "text" NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."inventory_transactions" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "product_variant_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_cost" integer,
    "total_cost" integer,
    "reference_type" "text",
    "reference_id" "text",
    "note" "text",
    "created_by" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: item_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."item_presets" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "purity" real DEFAULT 0,
    "gross_weight" real DEFAULT 0,
    "stone_weight" real DEFAULT 0,
    "price" integer DEFAULT 0,
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."order_items" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "product_variant_id" "text",
    "quantity" integer NOT NULL,
    "unit_price" integer NOT NULL,
    "discount" integer DEFAULT 0 NOT NULL,
    "total" integer NOT NULL,
    "created_at" "text" NOT NULL,
    "item_name" "text",
    "metal_details" "text"
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."orders" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "customer_id" "text",
    "channel_id" "text",
    "order_number" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "subtotal" integer DEFAULT 0 NOT NULL,
    "discount" integer DEFAULT 0 NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "created_by" "text",
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL,
    "trade_in_total" integer DEFAULT 0 NOT NULL,
    "trade_in_details" "text",
    "gold_price_99" integer DEFAULT 0 NOT NULL,
    "gold_sold_99" real DEFAULT 0 NOT NULL,
    "gold_bought_99" real DEFAULT 0 NOT NULL,
    "gold_to_money_99" real DEFAULT 0 NOT NULL,
    "gold_debt_99" real DEFAULT 0 NOT NULL,
    "making_fee_total" integer DEFAULT 0 NOT NULL,
    "order_type" "text" DEFAULT 'retail'::"text" NOT NULL,
    "is_quick" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "old_money_debt" integer DEFAULT 0,
    "old_gold_debt_99" real DEFAULT 0
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payments" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "method" "text" NOT NULL,
    "amount" integer NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "payment_date" "text" NOT NULL,
    "reference_no" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_variants" (
    "id" "text" NOT NULL,
    "product_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "barcode" "text",
    "attributes" "text",
    "price" integer NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."products" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "category_id" "text",
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "product_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "unit" "text" DEFAULT 'piece'::"text" NOT NULL,
    "base_price" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL,
    "brand_name" "text",
    "brand_symbol" "text",
    "brand_standard" "text",
    "brand_address" "text",
    "brand_id" "text"
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roles" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."settings" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" "text" NOT NULL
);


--
-- Name: silver_product_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."silver_product_details" (
    "id" "text" NOT NULL,
    "product_variant_id" "text" NOT NULL,
    "purity" "text" DEFAULT '925'::"text" NOT NULL,
    "gross_weight" real DEFAULT 0 NOT NULL,
    "stone_weight" real DEFAULT 0 NOT NULL,
    "net_weight" real DEFAULT 0 NOT NULL,
    "making_fee" integer DEFAULT 0 NOT NULL,
    "created_at" "text" NOT NULL
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stock_adjustments" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "inventory_transaction_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "approved_by" "text",
    "created_at" "text" NOT NULL
);


--
-- Name: stock_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stock_snapshots" (
    "product_variant_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "qty" integer DEFAULT 0 NOT NULL,
    "updated_at" "text" NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenants" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."users" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "role_id" "text",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "password_hash" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" "text" NOT NULL,
    "updated_at" "text" NOT NULL,
    "google_id" "text",
    "avatar_url" "text",
    "salt" "text"
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");


--
-- Name: api_rate_limits api_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("token_id", "window_start");


--
-- Name: api_tokens api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: api_tokens api_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_token_hash_key" UNIQUE ("token_hash");


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");


--
-- Name: brands brands_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_tenant_id_name_key" UNIQUE ("tenant_id", "name");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id");


--
-- Name: customer_debt_adjustments customer_debt_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."customer_debt_adjustments"
    ADD CONSTRAINT "customer_debt_adjustments_pkey" PRIMARY KEY ("id");


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");


--
-- Name: gold_invoice_items gold_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoice_items"
    ADD CONSTRAINT "gold_invoice_items_pkey" PRIMARY KEY ("id");


--
-- Name: gold_invoice_returns gold_invoice_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoice_returns"
    ADD CONSTRAINT "gold_invoice_returns_pkey" PRIMARY KEY ("id");


--
-- Name: gold_invoices gold_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoices"
    ADD CONSTRAINT "gold_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: gold_invoices gold_invoices_tenant_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoices"
    ADD CONSTRAINT "gold_invoices_tenant_id_invoice_number_key" UNIQUE ("tenant_id", "invoice_number");


--
-- Name: gold_price_history gold_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_price_history"
    ADD CONSTRAINT "gold_price_history_pkey" PRIMARY KEY ("id");


--
-- Name: gold_product_details gold_product_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_product_details"
    ADD CONSTRAINT "gold_product_details_pkey" PRIMARY KEY ("id");


--
-- Name: gold_product_details gold_product_details_product_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_product_details"
    ADD CONSTRAINT "gold_product_details_product_variant_id_key" UNIQUE ("product_variant_id");


--
-- Name: gold_types gold_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_types"
    ADD CONSTRAINT "gold_types_pkey" PRIMARY KEY ("id");


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: item_presets item_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."item_presets"
    ADD CONSTRAINT "item_presets_pkey" PRIMARY KEY ("id");


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_tenant_id_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_tenant_id_order_number_key" UNIQUE ("tenant_id", "order_number");


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");


--
-- Name: product_variants product_variants_tenant_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_tenant_id_sku_key" UNIQUE ("tenant_id", "sku");


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


--
-- Name: products products_tenant_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tenant_id_sku_key" UNIQUE ("tenant_id", "sku");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");


--
-- Name: settings settings_tenant_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_tenant_id_key_key" UNIQUE ("tenant_id", "key");


--
-- Name: silver_product_details silver_product_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."silver_product_details"
    ADD CONSTRAINT "silver_product_details_pkey" PRIMARY KEY ("id");


--
-- Name: silver_product_details silver_product_details_product_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."silver_product_details"
    ADD CONSTRAINT "silver_product_details_product_variant_id_key" UNIQUE ("product_variant_id");


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");


--
-- Name: stock_snapshots stock_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_pkey" PRIMARY KEY ("product_variant_id");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_tenant_id_email_key" UNIQUE ("tenant_id", "email");


--
-- Name: idx_addresses_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_addresses_customer" ON "public"."customer_addresses" USING "btree" ("customer_id");


--
-- Name: idx_api_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_api_tokens_hash" ON "public"."api_tokens" USING "btree" ("token_hash");


--
-- Name: idx_api_tokens_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_api_tokens_tenant" ON "public"."api_tokens" USING "btree" ("tenant_id");


--
-- Name: idx_categories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_categories_tenant" ON "public"."categories" USING "btree" ("tenant_id");


--
-- Name: idx_cda_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cda_customer" ON "public"."customer_debt_adjustments" USING "btree" ("customer_id");


--
-- Name: idx_channels_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_channels_tenant" ON "public"."channels" USING "btree" ("tenant_id");


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("phone");


--
-- Name: idx_customers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_customers_tenant" ON "public"."customers" USING "btree" ("tenant_id");


--
-- Name: idx_gold_details_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_details_variant" ON "public"."gold_product_details" USING "btree" ("product_variant_id");


--
-- Name: idx_gold_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_invoices_customer" ON "public"."gold_invoices" USING "btree" ("customer_id");


--
-- Name: idx_gold_invoices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_invoices_tenant" ON "public"."gold_invoices" USING "btree" ("tenant_id", "invoice_date" DESC);


--
-- Name: idx_gold_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_items_invoice" ON "public"."gold_invoice_items" USING "btree" ("invoice_id", "sort_order");


--
-- Name: idx_gold_price_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_price_type" ON "public"."gold_price_history" USING "btree" ("gold_type_id", "effective_at");


--
-- Name: idx_gold_returns_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gold_returns_invoice" ON "public"."gold_invoice_returns" USING "btree" ("invoice_id", "sort_order");


--
-- Name: idx_inv_tx_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inv_tx_reference" ON "public"."inventory_transactions" USING "btree" ("reference_type", "reference_id");


--
-- Name: idx_inv_tx_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inv_tx_tenant" ON "public"."inventory_transactions" USING "btree" ("tenant_id");


--
-- Name: idx_inv_tx_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_inv_tx_variant" ON "public"."inventory_transactions" USING "btree" ("product_variant_id");


--
-- Name: idx_item_presets_tenant_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_item_presets_tenant_kind" ON "public"."item_presets" USING "btree" ("tenant_id", "kind");


--
-- Name: idx_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_logs_entity" ON "public"."activity_logs" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_logs_tenant" ON "public"."activity_logs" USING "btree" ("tenant_id");


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");


--
-- Name: idx_order_items_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_order_items_variant" ON "public"."order_items" USING "btree" ("product_variant_id");


--
-- Name: idx_orders_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_channel" ON "public"."orders" USING "btree" ("channel_id");


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id");


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");


--
-- Name: idx_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_orders_tenant" ON "public"."orders" USING "btree" ("tenant_id");


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_order" ON "public"."payments" USING "btree" ("order_id");


--
-- Name: idx_payments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payments_tenant" ON "public"."payments" USING "btree" ("tenant_id");


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category_id");


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");


--
-- Name: idx_products_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_tenant" ON "public"."products" USING "btree" ("tenant_id");


--
-- Name: idx_products_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_products_type" ON "public"."products" USING "btree" ("product_type");


--
-- Name: idx_silver_details_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_silver_details_variant" ON "public"."silver_product_details" USING "btree" ("product_variant_id");


--
-- Name: idx_stock_snapshots_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_stock_snapshots_tenant" ON "public"."stock_snapshots" USING "btree" ("tenant_id");


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_users_google_id" ON "public"."users" USING "btree" ("google_id") WHERE ("google_id" IS NOT NULL);


--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_users_tenant" ON "public"."users" USING "btree" ("tenant_id");


--
-- Name: idx_variants_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_variants_barcode" ON "public"."product_variants" USING "btree" ("barcode");


--
-- Name: idx_variants_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_variants_product" ON "public"."product_variants" USING "btree" ("product_id");


--
-- Name: activity_logs activity_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");


--
-- Name: brands brands_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id");


--
-- Name: categories categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: channels channels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");


--
-- Name: customers customers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: gold_invoice_items gold_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoice_items"
    ADD CONSTRAINT "gold_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."gold_invoices"("id") ON DELETE CASCADE;


--
-- Name: gold_invoice_returns gold_invoice_returns_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoice_returns"
    ADD CONSTRAINT "gold_invoice_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."gold_invoices"("id") ON DELETE CASCADE;


--
-- Name: gold_invoices gold_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoices"
    ADD CONSTRAINT "gold_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: gold_invoices gold_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoices"
    ADD CONSTRAINT "gold_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");


--
-- Name: gold_invoices gold_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_invoices"
    ADD CONSTRAINT "gold_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: gold_price_history gold_price_history_gold_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_price_history"
    ADD CONSTRAINT "gold_price_history_gold_type_id_fkey" FOREIGN KEY ("gold_type_id") REFERENCES "public"."gold_types"("id");


--
-- Name: gold_price_history gold_price_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_price_history"
    ADD CONSTRAINT "gold_price_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: gold_product_details gold_product_details_gold_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_product_details"
    ADD CONSTRAINT "gold_product_details_gold_type_id_fkey" FOREIGN KEY ("gold_type_id") REFERENCES "public"."gold_types"("id");


--
-- Name: gold_product_details gold_product_details_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_product_details"
    ADD CONSTRAINT "gold_product_details_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id");


--
-- Name: gold_types gold_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gold_types"
    ADD CONSTRAINT "gold_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: inventory_transactions inventory_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: inventory_transactions inventory_transactions_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id");


--
-- Name: inventory_transactions inventory_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");


--
-- Name: order_items order_items_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id");


--
-- Name: orders orders_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id");


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");


--
-- Name: orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");


--
-- Name: product_variants product_variants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: roles roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: settings settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: silver_product_details silver_product_details_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."silver_product_details"
    ADD CONSTRAINT "silver_product_details_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");


--
-- Name: stock_adjustments stock_adjustments_inventory_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_inventory_transaction_id_fkey" FOREIGN KEY ("inventory_transaction_id") REFERENCES "public"."inventory_transactions"("id");


--
-- Name: stock_adjustments stock_adjustments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: stock_snapshots stock_snapshots_product_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id");


--
-- Name: stock_snapshots stock_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- PostgreSQL database dump complete
--

\unrestrict cw9XHVyxSgu6vcUZ5u4sI3KHnwGc3xMavTkK3yShLk9BabaMftYH9i4t50GSnJO


