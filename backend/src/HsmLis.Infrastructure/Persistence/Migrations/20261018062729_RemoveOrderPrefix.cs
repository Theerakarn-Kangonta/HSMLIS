using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveOrderPrefix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "order_prefix",
                schema: "hsmlis",
                table: "organizations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "order_prefix",
                schema: "hsmlis",
                table: "organizations",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "");
        }
    }
}
