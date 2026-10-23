using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserLicenseNo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "license_no",
                schema: "hsmlis",
                table: "users",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "license_no",
                schema: "hsmlis",
                table: "users");
        }
    }
}
