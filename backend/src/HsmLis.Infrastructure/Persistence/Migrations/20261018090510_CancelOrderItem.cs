using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CancelOrderItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cancel_reason",
                schema: "hsmlis",
                table: "order_items",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                schema: "hsmlis",
                table: "order_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cancelled_by_name",
                schema: "hsmlis",
                table: "order_items",
                type: "character varying(170)",
                maxLength: 170,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancel_reason",
                schema: "hsmlis",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                schema: "hsmlis",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "cancelled_by_name",
                schema: "hsmlis",
                table: "order_items");
        }
    }
}
