using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "hsmlis");

            migrationBuilder.CreateTable(
                name: "organizations",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name_th = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    tax_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    time_zone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    order_prefix = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    auto_logout_minutes = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: false),
                    action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    entity_id = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_audit_logs_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "branches",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name_th = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    tax_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branches", x => x.id);
                    table.ForeignKey(
                        name: "fk_branches_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "departments",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name_en = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    name_th = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_departments", x => x.id);
                    table.ForeignKey(
                        name: "fk_departments_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "number_sequences",
                schema: "hsmlis",
                columns: table => new
                {
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_number_sequences", x => new { x.organization_id, x.key });
                    table.ForeignKey(
                        name: "fk_number_sequences_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "patients",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hn = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    prefix = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    first_name_th = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    last_name_th = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    first_name_en = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    last_name_en = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    citizen_id = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: true),
                    sex = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    blood_group = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    nationality = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    line_id = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    province = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    post_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    emergency_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    emergency_phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    emergency_relation = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    allergies = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    conditions = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    medications = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_patients", x => x.id);
                    table.ForeignKey(
                        name: "fk_patients_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "referring_organizations",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    address = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    contact = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_referring_organizations", x => x.id);
                    table.ForeignKey(
                        name: "fk_referring_organizations_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "specimen_types",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name_en = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    name_th = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    container_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    collection_requirements = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    preservation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_specimen_types", x => x.id);
                    table.ForeignKey(
                        name: "fk_specimen_types_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "test_packages",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    name_th = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    test_ids = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    discount_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    discount_value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_test_packages", x => x.id);
                    table.ForeignKey(
                        name: "fk_test_packages_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    first_name_th = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    last_name_th = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    first_name_en = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    last_name_en = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    position = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    employee_code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    department_ids = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    locked_until = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                    table.ForeignKey(
                        name: "fk_users_branches_branch_id",
                        column: x => x.branch_id,
                        principalSchema: "hsmlis",
                        principalTable: "branches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_users_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "lab_tests",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    department_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name_th = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    specimen_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    result_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    options = table.Column<List<string>>(type: "text[]", nullable: false),
                    decimals = table.Column<int>(type: "integer", nullable: false),
                    tat_target_hours = table.Column<int>(type: "integer", nullable: false),
                    repeat_block_days = table.Column<int>(type: "integer", nullable: false),
                    alert_on_positive = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    reference_ranges = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lab_tests", x => x.id);
                    table.ForeignKey(
                        name: "fk_lab_tests_departments_department_id",
                        column: x => x.department_id,
                        principalSchema: "hsmlis",
                        principalTable: "departments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_lab_tests_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_lab_tests_specimen_types_specimen_type_id",
                        column: x => x.specimen_type_id,
                        principalSchema: "hsmlis",
                        principalTable: "specimen_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lab_orders",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_no = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    referrer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    referrer_ref = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    entitlement = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    urgent = table.Column<bool>(type: "boolean", nullable: false),
                    diagnosis = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    bp_systolic = table.Column<int>(type: "integer", nullable: true),
                    bp_diastolic = table.Column<int>(type: "integer", nullable: true),
                    heart_rate = table.Column<int>(type: "integer", nullable: true),
                    temperature_c = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    weight_kg = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    height_cm = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ordered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ordered_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ordered_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: false),
                    collected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    version = table.Column<int>(type: "integer", nullable: false),
                    packages = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lab_orders", x => x.id);
                    table.ForeignKey(
                        name: "fk_lab_orders_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_lab_orders_patients_patient_id",
                        column: x => x.patient_id,
                        principalSchema: "hsmlis",
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_lab_orders_referrers_referrer_id",
                        column: x => x.referrer_id,
                        principalSchema: "hsmlis",
                        principalTable: "referring_organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_lab_orders_users_ordered_by_id",
                        column: x => x.ordered_by_id,
                        principalSchema: "hsmlis",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "invoices",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_no = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    lab_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    paid = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoices", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoices_lab_orders_lab_order_id",
                        column: x => x.lab_order_id,
                        principalSchema: "hsmlis",
                        principalTable: "lab_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_invoices_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_invoices_patients_patient_id",
                        column: x => x.patient_id,
                        principalSchema: "hsmlis",
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "specimen_containers",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lab_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lsn = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    specimen_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    container_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    label_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    collected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    collected_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    received_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true),
                    volume = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    condition = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    comment = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    rejected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    rejected_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    replaces_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_specimen_containers", x => x.id);
                    table.ForeignKey(
                        name: "fk_specimen_containers_lab_orders_lab_order_id",
                        column: x => x.lab_order_id,
                        principalSchema: "hsmlis",
                        principalTable: "lab_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_specimen_containers_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_specimen_containers_specimen_types_specimen_type_id",
                        column: x => x.specimen_type_id,
                        principalSchema: "hsmlis",
                        principalTable: "specimen_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    received_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_payments_invoices_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "hsmlis",
                        principalTable: "invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payments_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lab_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lab_test_id = table.Column<Guid>(type: "uuid", nullable: false),
                    package_id = table.Column<Guid>(type: "uuid", nullable: true),
                    package_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    test_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    test_name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    test_name_th = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    department_id = table.Column<Guid>(type: "uuid", nullable: false),
                    specimen_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: true),
                    result_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    options = table.Column<List<string>>(type: "text[]", nullable: false),
                    decimals = table.Column<int>(type: "integer", nullable: false),
                    unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    tat_target_hours = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    result_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    flag = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ref_low = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    ref_high = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    critical_low = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    critical_high = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    ref_text = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    entered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    entered_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    entered_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    verified_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    verified_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true),
                    approved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    approved_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    approved_by_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_items_containers_container_id",
                        column: x => x.container_id,
                        principalSchema: "hsmlis",
                        principalTable: "specimen_containers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_order_items_lab_orders_lab_order_id",
                        column: x => x.lab_order_id,
                        principalSchema: "hsmlis",
                        principalTable: "lab_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_items_lab_tests_lab_test_id",
                        column: x => x.lab_test_id,
                        principalSchema: "hsmlis",
                        principalTable: "lab_tests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_order_items_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "result_events",
                schema: "hsmlis",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    flag = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_name = table.Column<string>(type: "character varying(170)", maxLength: 170, nullable: false),
                    at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_result_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_result_events_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalSchema: "hsmlis",
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_result_events_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_logs_organization_id_at",
                schema: "hsmlis",
                table: "audit_logs",
                columns: new[] { "organization_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_branches_organization_id_code",
                schema: "hsmlis",
                table: "branches",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_departments_organization_id_code",
                schema: "hsmlis",
                table: "departments",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoices_lab_order_id",
                schema: "hsmlis",
                table: "invoices",
                column: "lab_order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoices_organization_id_invoice_no",
                schema: "hsmlis",
                table: "invoices",
                columns: new[] { "organization_id", "invoice_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoices_organization_id_status",
                schema: "hsmlis",
                table: "invoices",
                columns: new[] { "organization_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_invoices_patient_id",
                schema: "hsmlis",
                table: "invoices",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_ordered_by_id",
                schema: "hsmlis",
                table: "lab_orders",
                column: "ordered_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_organization_id_order_no",
                schema: "hsmlis",
                table: "lab_orders",
                columns: new[] { "organization_id", "order_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_organization_id_ordered_at",
                schema: "hsmlis",
                table: "lab_orders",
                columns: new[] { "organization_id", "ordered_at" });

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_organization_id_status",
                schema: "hsmlis",
                table: "lab_orders",
                columns: new[] { "organization_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_patient_id",
                schema: "hsmlis",
                table: "lab_orders",
                column: "patient_id");

            migrationBuilder.CreateIndex(
                name: "ix_lab_orders_referrer_id",
                schema: "hsmlis",
                table: "lab_orders",
                column: "referrer_id");

            migrationBuilder.CreateIndex(
                name: "ix_lab_tests_department_id",
                schema: "hsmlis",
                table: "lab_tests",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "ix_lab_tests_organization_id_code",
                schema: "hsmlis",
                table: "lab_tests",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lab_tests_specimen_type_id",
                schema: "hsmlis",
                table: "lab_tests",
                column: "specimen_type_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_container_id",
                schema: "hsmlis",
                table: "order_items",
                column: "container_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_lab_order_id",
                schema: "hsmlis",
                table: "order_items",
                column: "lab_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_lab_test_id",
                schema: "hsmlis",
                table: "order_items",
                column: "lab_test_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_organization_id_result_status",
                schema: "hsmlis",
                table: "order_items",
                columns: new[] { "organization_id", "result_status" });

            migrationBuilder.CreateIndex(
                name: "ix_patients_organization_id_citizen_id",
                schema: "hsmlis",
                table: "patients",
                columns: new[] { "organization_id", "citizen_id" });

            migrationBuilder.CreateIndex(
                name: "ix_patients_organization_id_created_at",
                schema: "hsmlis",
                table: "patients",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_patients_organization_id_hn",
                schema: "hsmlis",
                table: "patients",
                columns: new[] { "organization_id", "hn" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_invoice_id",
                schema: "hsmlis",
                table: "payments",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_organization_id_paid_at",
                schema: "hsmlis",
                table: "payments",
                columns: new[] { "organization_id", "paid_at" });

            migrationBuilder.CreateIndex(
                name: "ix_referring_organizations_organization_id_code",
                schema: "hsmlis",
                table: "referring_organizations",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_result_events_order_item_id_at",
                schema: "hsmlis",
                table: "result_events",
                columns: new[] { "order_item_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_result_events_organization_id",
                schema: "hsmlis",
                table: "result_events",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_specimen_containers_lab_order_id",
                schema: "hsmlis",
                table: "specimen_containers",
                column: "lab_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_specimen_containers_organization_id_lsn",
                schema: "hsmlis",
                table: "specimen_containers",
                columns: new[] { "organization_id", "lsn" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_specimen_containers_organization_id_status",
                schema: "hsmlis",
                table: "specimen_containers",
                columns: new[] { "organization_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_specimen_containers_specimen_type_id",
                schema: "hsmlis",
                table: "specimen_containers",
                column: "specimen_type_id");

            migrationBuilder.CreateIndex(
                name: "ix_specimen_types_organization_id_code",
                schema: "hsmlis",
                table: "specimen_types",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_test_packages_organization_id_code",
                schema: "hsmlis",
                table: "test_packages",
                columns: new[] { "organization_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_branch_id",
                schema: "hsmlis",
                table: "users",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_organization_id",
                schema: "hsmlis",
                table: "users",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_username",
                schema: "hsmlis",
                table: "users",
                column: "username",
                unique: true);

            // The audit log and result history are evidence: the database itself refuses to
            // change or remove their rows, whatever the application does.
            migrationBuilder.Sql("""
                CREATE FUNCTION hsmlis.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
                END $$;
                CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON hsmlis.audit_logs
                    FOR EACH ROW EXECUTE FUNCTION hsmlis.refuse_change();
                CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON hsmlis.audit_logs
                    FOR EACH STATEMENT EXECUTE FUNCTION hsmlis.refuse_change();
                CREATE TRIGGER result_events_append_only BEFORE UPDATE OR DELETE ON hsmlis.result_events
                    FOR EACH ROW EXECUTE FUNCTION hsmlis.refuse_change();
                CREATE TRIGGER result_events_no_truncate BEFORE TRUNCATE ON hsmlis.result_events
                    FOR EACH STATEMENT EXECUTE FUNCTION hsmlis.refuse_change();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS audit_logs_append_only ON hsmlis.audit_logs;
                DROP TRIGGER IF EXISTS audit_logs_no_truncate ON hsmlis.audit_logs;
                DROP TRIGGER IF EXISTS result_events_append_only ON hsmlis.result_events;
                DROP TRIGGER IF EXISTS result_events_no_truncate ON hsmlis.result_events;
                DROP FUNCTION IF EXISTS hsmlis.refuse_change();
                """);

            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "number_sequences",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "result_events",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "test_packages",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "invoices",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "order_items",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "specimen_containers",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "lab_tests",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "lab_orders",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "departments",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "specimen_types",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "patients",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "referring_organizations",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "users",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "branches",
                schema: "hsmlis");

            migrationBuilder.DropTable(
                name: "organizations",
                schema: "hsmlis");
        }
    }
}
