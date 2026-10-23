using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PatientIdCardFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "card_expiry_date",
                schema: "hsmlis",
                table: "patients",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "card_issue_date",
                schema: "hsmlis",
                table: "patients",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "card_issuer",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "district",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "marital_status",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "occupation",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "prefix_en",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subdistrict",
                schema: "hsmlis",
                table: "patients",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "card_expiry_date",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "card_issue_date",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "card_issuer",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "district",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "marital_status",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "occupation",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "prefix_en",
                schema: "hsmlis",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "subdistrict",
                schema: "hsmlis",
                table: "patients");
        }
    }
}
