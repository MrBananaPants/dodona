# == Schema Information
#
# Table name: institutions
#
#  id          :bigint(8)        not null, primary key
#  name        :string(255)
#  short_name  :string(255)
#  logo        :string(255)
#  sso_url     :string(255)
#  slo_url     :string(255)
#  certificate :text(65535)
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  entity_id   :string(255)
#  provider    :integer
#  identifier  :string(255)
#

class Institution < ApplicationRecord
  NEW_INSTITUTION_NAME = 'n/a'.freeze
  enum provider: %i[smartschool office365 saml google_oauth2]

  has_many :users, dependent: :restrict_with_error
  has_many :courses, dependent: :restrict_with_error

  validates :identifier, uniqueness: { allow_blank: true }
  validates :logo, :short_name, :provider, presence: true
  validates :sso_url, :slo_url, :certificate, :entity_id, presence: true, if: :saml?

  def self.from_identifier(identifier)
    find_by(identifier: identifier) if identifier.present?
  end

  def self.of_course(course_id)
    includes(:courses).where(courses: { id: course.id})
  end

end
