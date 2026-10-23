using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HsmLis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PatientPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "photo_at",
                schema: "hsmlis",
                table: "patients",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "patient_photos",
                schema: "hsmlis",
                columns: table => new
                {
                    patient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    data = table.Column<byte[]>(type: "bytea", nullable: false),
                    content_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_patient_photos", x => x.patient_id);
                    table.ForeignKey(
                        name: "fk_patient_photos_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "hsmlis",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_patient_photos_patients_patient_id",
                        column: x => x.patient_id,
                        principalSchema: "hsmlis",
                        principalTable: "patients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_patient_photos_organization_id",
                schema: "hsmlis",
                table: "patient_photos",
                column: "organization_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "patient_photos",
                schema: "hsmlis");

            migrationBuilder.DropColumn(
                name: "photo_at",
                schema: "hsmlis",
                table: "patients");
        }
    }
}
